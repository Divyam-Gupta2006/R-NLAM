-- AlterTable
ALTER TABLE "Parcel" ADD COLUMN     "urgencyOrderRef" TEXT;


-- ---------------------------------------------------------------------------
-- 6.2 Liability facts. The money is computed in TypeScript (tested, BigInt);
-- these views only gather the dated facts it needs, so dashboards read one
-- indexed table instead of joining six. REFRESH ... CONCURRENTLY after writes.
-- ---------------------------------------------------------------------------

-- Compensation lines still unpaid when possession was taken (s.80).
CREATE MATERIALIZED VIEW mv_liability_s80 AS
SELECT c.id                AS compensation_id,
       p.id                AS parcel_id,
       p."parcelNumber"    AS parcel_number,
       p."projectId"       AS project_id,
       p."stateCode"       AS state_code,
       p."stateName"       AS state_name,
       p."districtCode"    AS district_code,
       p."districtName"    AS district_name,
       p."villageId"       AS village_id,
       p."villageName"     AS village_name,
       c."beneficiaryName" AS beneficiary,
       c."amountPaise"     AS principal_paise,
       pos."takenOn"       AS possession_on,
       c."paidOn"          AS paid_on
FROM "Compensation" c
JOIN "Parcel" p ON p.id = c."parcelId"
JOIN "Possession" pos ON pos."parcelId" = p.id
WHERE pos."takenOn" IS NOT NULL
  AND (c."paidOn" IS NULL OR c."paidOn" > pos."takenOn");
CREATE UNIQUE INDEX mv_liability_s80_pk ON mv_liability_s80 (compensation_id);
CREATE INDEX mv_liability_s80_geo ON mv_liability_s80 (state_code, district_code);

-- Parcels on which the s.30(3) additional amount has run (or is running).
CREATE MATERIALIZED VIEW mv_liability_additional AS
SELECT p.id                AS parcel_id,
       p."parcelNumber"    AS parcel_number,
       p."projectId"       AS project_id,
       p."stateCode"       AS state_code,
       p."stateName"       AS state_name,
       p."districtCode"    AS district_code,
       p."districtName"    AS district_name,
       p."villageId"       AS village_id,
       p."villageName"     AS village_name,
       p.stage::text       AS stage,
       round(p."marketRatePaisePerHa" * p."totalAreaHa")::bigint AS market_value_paise,
       coalesce(sia.first_on, s11.first_on) AS start_on,
       CASE WHEN sia.first_on IS NULL THEN 'SEC_11_PRELIMINARY' ELSE 'SEC_4_SIA' END AS start_event,
       least(aw.first_on, pos."takenOn") AS stop_on
FROM "Parcel" p
LEFT JOIN LATERAL (SELECT min(n."publishedOn") AS first_on FROM "StatutoryNotice" n JOIN "_ParcelToStatutoryNotice" pn ON pn."B" = n.id WHERE pn."A" = p.id AND n.kind = 'SEC_4_SIA') sia ON true
LEFT JOIN LATERAL (SELECT min(n."publishedOn") AS first_on FROM "StatutoryNotice" n JOIN "_ParcelToStatutoryNotice" pn ON pn."B" = n.id WHERE pn."A" = p.id AND n.kind = 'SEC_11_PRELIMINARY') s11 ON true
LEFT JOIN LATERAL (SELECT min(a."awardDate") AS first_on FROM "Award" a WHERE a."parcelId" = p.id) aw ON true
LEFT JOIN "Possession" pos ON pos."parcelId" = p.id
WHERE p."marketRatePaisePerHa" IS NOT NULL
  AND p.stage NOT IN ('WITHDRAWN', 'LAPSED')
  AND coalesce(sia.first_on, s11.first_on) IS NOT NULL;
CREATE UNIQUE INDEX mv_liability_additional_pk ON mv_liability_additional (parcel_id);
CREATE INDEX mv_liability_additional_geo ON mv_liability_additional (state_code, district_code);
