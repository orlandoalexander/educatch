import { useContext } from "react";
import { UserContext } from "../UserContext";
import { useQuery } from "react-query";
import api from "./api";

const useGetInvoices = () => {
  const { user } = useContext(UserContext);
  const { role, role_id, id } = user;
  const getInvoices = async () => {
    const response = await api.get(
      `/invoices/${role}${role === "admin" ? "" : `/${role_id}`}`
    );
    return response.data;
  };
  return useQuery(["invoices", id], getInvoices);
};

export default useGetInvoices;
