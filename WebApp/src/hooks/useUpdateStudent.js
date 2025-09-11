import { useMutation, useQueryClient } from "react-query";
import api from "./api";

const updateStudent = async ({ id: studentId, data }) => {
  const response = await api.put(`/students/${studentId}`, data);
  return response.data;
};

const useUpdateStudent = () => {
  const queryClient = useQueryClient();

  return useMutation(updateStudent, {
    onSuccess: () => queryClient.invalidateQueries("students"),
  });
};

export default useUpdateStudent;
