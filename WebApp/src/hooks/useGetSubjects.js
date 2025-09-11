import { useQuery } from "react-query";
import api from "./api";

const useGetSubjects = () => {
  const getSubjects = async () => {
    const response = await api.get(`/subjects`);

    return response.data;
  };

  return useQuery("subjects", getSubjects);
};

export default useGetSubjects;
