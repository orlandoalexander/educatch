import { useContext } from "react";
import { UserContext } from "../UserContext";
import { useQuery } from "react-query";
import api from "./api";

const useGetReports = () => {
  const { user } = useContext(UserContext);
  const { role, role_id, id } = user;
  const getReports = async () => {
    const response = await api.get(
      `/reports/${role}${role === "admin" ? "" : `/${role_id}`}`
    );
    return response.data;
  };

  return useQuery(["reports", id], getReports);
};

export default useGetReports;
