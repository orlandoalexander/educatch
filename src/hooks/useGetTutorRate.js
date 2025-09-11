import { useContext } from "react";
import { UserContext } from "../UserContext";
import { useQuery } from "react-query";
import api from "./api";

const useGetTutorRate = () => {
  const { user } = useContext(UserContext);
  const { role_id } = user;
  const getTutorRate = async () => {
    const response = await api.get(`/tutors/${role_id}/rate`);
    return parseInt(response.data);
  };

  return useQuery(["tutor--rate", role_id], getTutorRate);
};

export default useGetTutorRate;
