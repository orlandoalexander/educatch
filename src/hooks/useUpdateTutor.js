import { useMutation, useQueryClient } from "react-query";
import api from "./api";

const updateTutor = async ({ id: tutorId, data }) => {
  const response = await api.put(`/tutors/${tutorId}`, data);
  return response.data;
};

const useUpdateTutor = () => {
  const queryClient = useQueryClient();

  return useMutation(updateTutor, {
    onSuccess: () => queryClient.invalidateQueries("tutors"),
  });
};

export default useUpdateTutor;
