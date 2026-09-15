'use client';

import React, { useEffect, useState } from 'react';
import { usersApi } from '@/lib/api/client';
import { Users, UserCheck, Shield } from 'lucide-react';

export default function CentralUsersPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    usersApi.getAll()
      .then((res) => {
        if (res.data) {
          setUsers(res.data);
        } else {
          setError(res.error || 'Failed to load user list');
        }
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">User & Organization Directory</h1>
        <p className="text-gray-600">Database user accounts across all 9 R-NLAM stakeholder roles</p>
      </div>

      {loading && (
        <div className="p-12 text-center text-gray-500 bg-white rounded-xl shadow-sm border border-gray-100">
          Loading user directory from PostgreSQL...
        </div>
      )}

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
          Failed to fetch users: {error}
        </div>
      )}

      {!loading && !error && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-gray-700 font-semibold border-b border-gray-200 text-xs uppercase">
              <tr>
                <th className="p-4">Name & Email</th>
                <th className="p-4">Assigned Role</th>
                <th className="p-4">Organization</th>
                <th className="p-4">Jurisdiction</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-gray-50 transition">
                  <td className="p-4 font-medium text-gray-900">
                    {u.name}
                    <span className="block text-xs text-gray-500">{u.email}</span>
                  </td>
                  <td className="p-4">
                    <span className="px-2.5 py-1 text-xs font-bold bg-indigo-100 text-indigo-800 rounded">
                      {u.role}
                    </span>
                  </td>
                  <td className="p-4 text-gray-600 text-xs">
                    {u.organization?.name || 'Central Administration'}
                  </td>
                  <td className="p-4 text-gray-600 text-xs">
                    {u.jurisdiction ? `${u.jurisdiction.districtName}, ${u.jurisdiction.stateName}` : 'National / All'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
