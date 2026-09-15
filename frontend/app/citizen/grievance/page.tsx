'use client';

import React, { useState } from 'react';
import { citizenApi } from '@/lib/api/client';
import { FileText, Send, CheckCircle2 } from 'lucide-react';

export default function CitizenGrievancePage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [khasraNumber, setKhasraNumber] = useState('');
  const [remarks, setRemarks] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setSuccessMsg(null);

    citizenApi.submitGrievance({
      name,
      email,
      phone,
      khasraNumber,
      remarks,
    })
      .then((res) => {
        if (res.data) {
          setSuccessMsg('Grievance representation submitted successfully to District CALA Officer.');
          setName('');
          setEmail('');
          setPhone('');
          setKhasraNumber('');
          setRemarks('');
        } else {
          setError(res.error || 'Failed to submit grievance');
        }
      })
      .catch((err) => setError(err.message))
      .finally(() => setSubmitting(false));
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Submit Representation / Grievance</h1>
        <p className="text-gray-600">File a statutory representation or grievance regarding land measurement, title, or compensation award under Section 15</p>
      </div>

      {successMsg && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg text-sm flex items-center gap-2 font-medium">
          <CheckCircle2 className="w-5 h-5 text-emerald-600" /> {successMsg}
        </div>
      )}

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
          Failed to submit grievance: {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Full Name</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3.5 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="Landowner / Applicant Name"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Phone Number</label>
            <input
              type="tel"
              required
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full px-3.5 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="10-digit mobile number"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Email Address</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3.5 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="name@example.com"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Khasra / Survey Number</label>
            <input
              type="text"
              required
              value={khasraNumber}
              onChange={(e) => setKhasraNumber(e.target.value)}
              className="w-full px-3.5 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="e.g. 78/2A"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-700 mb-1">Objection Details / Representation Remarks</label>
          <textarea
            required
            rows={4}
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            className="w-full px-3.5 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            placeholder="Specify your objection details regarding compensation amount, land measurement discrepancy, or title dispute..."
          ></textarea>
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg text-sm transition flex items-center justify-center gap-2"
        >
          <Send className="w-4 h-4" /> {submitting ? 'Submitting Grievance...' : 'Submit Grievance Representation'}
        </button>
      </form>
    </div>
  );
}
