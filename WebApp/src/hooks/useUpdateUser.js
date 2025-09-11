import { useMutation, useQueryClient } from "react-query";
import api from "./api";

const updateUser = async ({ userId, data }) => {
  const response = await api.put(`/users/${userId}`, data);
  return response.data;
};

const useUpdateUser = () => {
  const queryClient = useQueryClient();

  return useMutation(updateUser, {
    onSuccess: () => queryClient.invalidateQueries("users"),
  });
};

export default useUpdateUser;
