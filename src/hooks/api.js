import axios from "axios";

const baseUrl = import.meta.env.VITE_BACKEND_BASE_URL;

// create an axios instance
const api = axios.create({
  baseURL: baseUrl,
  withCredentials: true,
});

// function to refresh access token
const refreshToken = async () => {
  const refreshToken = localStorage.getItem("educatch_refresh_token");
  try {
    const response = await axios.post(
      `${baseUrl}/refresh`,
      {},
      {
        headers: {
          Authorization: `Bearer ${refreshToken}`,
        },
      }
    );
    localStorage.setItem("educatch_access_token", response.data.access_token);
    return response.data.access_token;
  } catch (error) {
    console.error("Error refreshing token", error);
    throw error;
  }
};

// axios request interceptor
api.interceptors.request.use(
  (config) => {
    const accessToken = localStorage.getItem("educatch_access_token");

    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

    if (accessToken) {
      config.headers.Authorization = `Bearer ${accessToken}`;
    }

    config.headers["X-Timezone"] = timezone;
    return config;
  },
  (error) => Promise.reject(error)
);

// axios response interceptor
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const { response } = error;
    const { status } = response || {};

    if (status === 401) {
      // attempt to refresh the token
      try {
        const newAccessToken = await refreshToken();
        // retry the original request with the new access token
        const config = error.config;
        config.headers.Authorization = `Bearer ${newAccessToken}`;
        return api(config);
      } catch (refreshError) {
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

export default api;
