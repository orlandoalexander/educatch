import { useContext } from "react";
import { UserContext } from "../UserContext";
import { message } from "antd";
import { useMutation, useQueryClient } from "react-query";
import api from "./api";

const updateInvoice = async ({ invoiceId, role, data }) => {
  const hide = message.loading(
    role === "tutor"
      ? `Invoice${data.invoice_ids?.length > 1 ? "s" : ""} ${
          data.status === "submitted" ? "" : "un"
        }submitting...`
      : `Marking ${data.invoice_ids ? data.invoice_ids?.length : ""} invoice${
          data?.invoice_ids?.length > 1 ? "s" : ""
        } as ${
          data.status === "submitted"
            ? "submitted"
            : data.status === "unpaid"
            ? "submitted"
            : data.status === "ready"
            ? "unsubmitted"
            : "paid"
        }...`,
    0
  );
  try {
    if (invoiceId !== null && invoiceId !== undefined) {
      const response = await api.put(`/invoices/${invoiceId}`, data);
      return { success: response.data, hide };
    } else {
      const response = await api.put("/invoices", data);
      return { success: response.data, hide };
    }
  } catch (error) {
    hide(); // hide loading if error
    throw error;
  }
};

const useUpdateInvoice = () => {
  const queryClient = useQueryClient();
  const { user } = useContext(UserContext);
  const { id } = user;
  return useMutation(updateInvoice, {
    onSuccess: ({ success, hide }, data) => {
      hide();
      queryClient.invalidateQueries(["invoices", id]);
      queryClient.invalidateQueries([
        "invoice--student-report",
        data.invoiceId,
      ]);
      message.success(
        data.role === "tutor"
          ? `Invoice${data.data?.invoice_ids?.length > 1 ? "s" : ""} ${
              data.data.status === "submitted" ? "submitted" : "unsubmitted"
            }`
          : `Marked ${
              data.data?.invoice_ids ? data.data?.invoice_ids?.length : ""
            } invoice${data.data?.invoice_ids?.length > 1 ? "s" : ""} as ${
              data.data?.status === "submitted"
                ? "submitted"
                : data.data?.status === "ready"
                ? "unsubmitted"
                : "paid"
            }`
      );
    },
    onError: (error, data) => {
      message.error(
        data.role === "tutor"
          ? `Error ${
              data.data.status === "submitted" ? "" : "un"
            }submitting invoice${data.data?.invoice_ids?.length > 1 ? "s" : ""}`
          : `Error marking invoice as  ${
              data.data.status === "submitted"
                ? "submitted"
                : data.data?.status === "ready"
                ? "unsubmitted"
                : "paid"
            }`
      );
    },
  });
};

export default useUpdateInvoice;
