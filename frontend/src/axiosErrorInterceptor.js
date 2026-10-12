// Axios response interceptor that normalises FastAPI/Pydantic validation errors
// into a readable string, so toast.error(error.response.data.detail) never crashes
// React with "Objects are not valid as a React child".
import axios from 'axios';

function formatPydanticError(detail) {
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) {
    return detail
      .map((d) => {
        if (typeof d === 'string') return d;
        const loc = Array.isArray(d?.loc) ? d.loc.filter((x) => x !== 'body').join('.') : '';
        const msg = d?.msg || d?.message || JSON.stringify(d);
        return loc ? `${loc}: ${msg}` : msg;
      })
      .join(' • ');
  }
  if (detail && typeof detail === 'object') {
    return detail.msg || detail.message || JSON.stringify(detail);
  }
  return null;
}

axios.interceptors.response.use(
  (response) => response,
  (error) => {
    try {
      const data = error?.response?.data;
      if (data && data.detail !== undefined) {
        const formatted = formatPydanticError(data.detail);
        if (formatted) data.detail = formatted;
      }
    } catch (_) {
      /* swallow — never break the error chain */
    }
    return Promise.reject(error);
  }
);

export {};
