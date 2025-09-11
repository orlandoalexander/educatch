import { useQuery } from "react-query";
import api from "./api";

const useGetStudents = () => {
  const getStudents = async () => {
    const response = await api.get(`/students`);

    return response.data;
  };

  return useQuery("students", getStudents);
};

export default useGetStudents;
