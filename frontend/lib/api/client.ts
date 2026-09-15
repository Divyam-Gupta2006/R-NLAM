// Centralized Domain API Client for R-NLAM Frontend -> NestJS Backend (Port 4000)

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';
const AI_BASE_URL = process.env.NEXT_PUBLIC_AI_URL || 'http://localhost:8000/api/v1';

export interface ApiResponse<T = any> {
  data: T | null;
  error: string | null;
  status: number;
}

class ApiClient {
  private getAuthHeader(): Record<string, string> {
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('rnlam_jwt_token') || sessionStorage.getItem('rnlam_jwt_token');
      const role = localStorage.getItem('rnlam_active_role') || 'CENTRAL_ADMIN';
      return {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        'X-User-Role': role,
      };
    }
    return { 'X-User-Role': 'CENTRAL_ADMIN' };
  }

  public async get<T = any>(endpoint: string): Promise<ApiResponse<T>> {
    try {
      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...this.getAuthHeader(),
        },
      });

      if (!response.ok) {
        return { data: null, error: `HTTP ${response.status}: ${response.statusText}`, status: response.status };
      }

      const data = await response.json();
      return { data, error: null, status: response.status };
    } catch (err: any) {
      return { data: null, error: err.message || 'Network Error', status: 500 };
    }
  }

  public async post<T = any>(endpoint: string, payload: any): Promise<ApiResponse<T>> {
    try {
      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...this.getAuthHeader(),
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        return { data: null, error: `HTTP ${response.status}: ${response.statusText}`, status: response.status };
      }

      const data = await response.json();
      return { data, error: null, status: response.status };
    } catch (err: any) {
      return { data: null, error: err.message || 'Network Error', status: 500 };
    }
  }

  public async patch<T = any>(endpoint: string, payload: any): Promise<ApiResponse<T>> {
    try {
      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...this.getAuthHeader(),
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        return { data: null, error: `HTTP ${response.status}: ${response.statusText}`, status: response.status };
      }

      const data = await response.json();
      return { data, error: null, status: response.status };
    } catch (err: any) {
      return { data: null, error: err.message || 'Network Error', status: 500 };
    }
  }

  // AI Microservice API Calls
  public async callAi<T = any>(endpoint: string, payload: any): Promise<ApiResponse<T>> {
    try {
      const response = await fetch(`${AI_BASE_URL}${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        return { data: null, error: `AI HTTP ${response.status}: ${response.statusText}`, status: response.status };
      }

      const data = await response.json();
      return { data, error: null, status: response.status };
    } catch (err: any) {
      return { data: null, error: err.message || 'AI Microservice Network Error', status: 500 };
    }
  }
}

export const apiClient = new ApiClient();

// Typed Domain Resource API Modules

export const projectsApi = {
  getAll: (params?: { stateCode?: string; districtCode?: string }) => {
    const query = new URLSearchParams(params as any).toString();
    return apiClient.get(`/projects${query ? `?${query}` : ''}`);
  },
  getById: (id: string) => apiClient.get(`/projects/${id}`),
  create: (data: {
    code: string;
    name: string;
    sector: string;
    stateCode: string;
    stateName: string;
    districtCodes: string[];
    districtNames: string[];
    piaName: string;
    requiredLand: number;
    estimatedCost: number;
  }) => apiClient.post('/projects', data),
};

export const proposalsApi = {
  getAll: () => apiClient.get('/proposals'),
  updateStatus: (id: string, status: string, remarks?: string) =>
    apiClient.patch(`/proposals/${id}/status`, { status, remarks }),
};

export const workflowApi = {
  getTemplates: () => apiClient.get('/workflow/templates'),
  getInstanceByProjectId: (projectId: string) => apiClient.get(`/workflow/instance/${projectId}`),
  executeAction: (data: {
    instanceId: string;
    actionName: string;
    performedBy: string;
    fromStage: string;
    toStage: string;
    remarks?: string;
  }) => apiClient.post('/workflow/action', data),
};

export const parcelsApi = {
  getAll: (params?: { projectId?: string; villageName?: string }) => {
    const query = new URLSearchParams(params as any).toString();
    return apiClient.get(`/parcels${query ? `?${query}` : ''}`);
  },
  getById: (id: string) => apiClient.get(`/parcels/${id}`),
  verify: (data: {
    parcelId: string;
    verifiedBy: string;
    latitude: number;
    longitude: number;
    photoUrl?: string;
    notes?: string;
    status?: string;
  }) => apiClient.post('/parcels/verify', data),
};

export const gisApi = {
  getGeoJson: (projectId?: string) => apiClient.get(`/gis/geojson${projectId ? `?projectId=${projectId}` : ''}`),
  getSpatialStats: (projectId?: string) => apiClient.get(`/gis/stats${projectId ? `?projectId=${projectId}` : ''}`),
};

export const analyticsApi = {
  getKpis: () => apiClient.get('/analytics/kpis'),
  getProjectAnalytics: (id: string) => apiClient.get(`/analytics/project/${id}`),
  getStates: () => apiClient.get('/analytics/states'),
  getDistricts: (stateCode?: string) => apiClient.get(`/analytics/districts${stateCode ? `?stateCode=${stateCode}` : ''}`),
};

export const compensationApi = {
  getCases: (projectId?: string) =>
    apiClient.get(`/compensation/cases${projectId ? `?projectId=${projectId}` : ''}`),
  initiatePayment: (data: { caseId: string; bankAccount: string; ifscCode: string; amount: number }) =>
    apiClient.post('/compensation/initiate-payment', data),
};

export const rrApi = {
  getFamilies: () => apiClient.get('/rr/families'),
  getCases: (projectId?: string) => apiClient.get(`/rr/cases${projectId ? `?projectId=${projectId}` : ''}`),
  deliverBenefit: (data: { caseId: string; benefitName: string; remarks?: string }) =>
    apiClient.post('/rr/delivery', data),
};

export const possessionApi = {
  getCases: (projectId?: string) => apiClient.get(`/possession/cases${projectId ? `?projectId=${projectId}` : ''}`),
  record: (data: {
    projectId: string;
    parcelId: string;
    authority: string;
    latitude: number;
    longitude: number;
    remarks?: string;
  }) => apiClient.post('/possession/record', data),
};

export const auditApi = {
  getEvents: () => apiClient.get('/audit'),
  verifyChain: () => apiClient.get('/audit/verify-chain'),
};

export const notificationsApi = {
  getAll: () => apiClient.get('/notifications'),
  markRead: (id: string) => apiClient.patch(`/notifications/${id}/read`, {}),
};

export const usersApi = {
  getAll: () => apiClient.get('/users'),
  getById: (id: string) => apiClient.get(`/users/${id}`),
  create: (data: any) => apiClient.post('/users', data),
};

export const integrationsApi = {
  getStatus: () => apiClient.get('/integrations/status'),
  fetchBhoomi: (khasra: string) => apiClient.get(`/integrations/bhoomi/${khasra}`),
  processPFMS: (data: any) => apiClient.post('/integrations/pfms', data),
};

export const citizenApi = {
  getSummary: () => apiClient.get('/citizen/summary'),
  getProjects: () => apiClient.get('/citizen/projects'),
  getMyLand: (khasra?: string) => apiClient.get(`/citizen/my-land${khasra ? `?khasra=${khasra}` : ''}`),
  getMyCompensation: () => apiClient.get('/citizen/compensation'),
  getMyRR: () => apiClient.get('/citizen/rr'),
  submitGrievance: (data: any) => apiClient.post('/citizen/grievance', data),
};

export const slaApi = {
  getTasks: () => apiClient.get('/sla/tasks'),
  checkBreaches: () => apiClient.post('/sla/check-breaches', {}),
};

export const objectionsApi = {
  getAll: () => apiClient.get('/objections'),
  create: (data: any) => apiClient.post('/objections', data),
  updateStatus: (id: string, status: string) => apiClient.patch(`/objections/${id}/status`, { status }),
};

export const hearingsApi = {
  getAll: () => apiClient.get('/hearings'),
  create: (data: any) => apiClient.post('/hearings', data),
  updateDecision: (id: string, decision: string) => apiClient.patch(`/hearings/${id}/decision`, { decision }),
};

export const awardsApi = {
  getAll: () => apiClient.get('/awards'),
  create: (data: any) => apiClient.post('/awards', data),
};

export const documentsApi = {
  getAll: (projectId?: string) => apiClient.get(`/documents${projectId ? `?projectId=${projectId}` : ''}`),
  upload: (fileData: any) => apiClient.post('/documents/upload', fileData),
};

export const aiApi = {
  extractOcr: (fileBase64: string) => apiClient.callAi('/ocr/extract-document', { file_base64: fileBase64 }),
  assessRisk: (payload: any) => apiClient.callAi('/risk/assess-delay', payload),
  nlpQuery: (queryText: string, userRole: string = 'CENTRAL_ADMIN') =>
    apiClient.callAi('/analytics/nlp-query', { query_text: queryText, user_role: userRole }),
};
