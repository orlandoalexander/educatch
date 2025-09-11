import { useQuery } from "react-query";
import api from "./api";

const useGetRoles = () => {
  const getRoles = async () => {
    const response = await api.get(`/roles`);
    return response.data;
  };

  return useQuery("roles", getRoles);
};

export default useGetRoles;
