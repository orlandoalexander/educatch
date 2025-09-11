import { useQuery } from "react-query";
import api from "./api";

const useGetUsers = () => {
  const getUsers = async () => {
    const response = await api.get(`/users`);
    return response.data;
  };

  return useQuery("users", getUsers);
};

export default useGetUsers;
