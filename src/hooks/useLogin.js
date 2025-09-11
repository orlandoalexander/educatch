import { useMutation } from "react-query";
import axios from "axios";

const baseUrl = import.meta.env.VITE_BACKEND_BASE_URL;

const useLogin = (handleSignIn) => {
  const login = async (data) => {
    const response = await axios.post(`${baseUrl}/login`, data);
    return response.data;
  };

  return useMutation(login, {
    onSuccess: (success, data) => {
      const { id, role, role_id, access_token, refresh_token } = success.data;
      handleSignIn({
        id: id,
        role_id: role_id,
        role: role,
        access_token: access_token,
        refresh_token: refresh_token,
        remember: data.remember,
      });
    },
  });
};

export default useLogin;
