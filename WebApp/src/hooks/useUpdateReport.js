import { useContext } from "react";
import { UserContext } from "../UserContext";
import { message } from "antd";
import { useMutation, useQueryClient } from "react-query";
import api from "./api";

const updateReport = async ({
  reportId,
  invoiceId,
  lessonOccurrenceId,
  studentId,
  data,
  loadingMessage,
  successMessage,
}) => {
  let hide;
  // Show loading message if provided
  if (loadingMessage) {
    hide = message.loading(loadingMessage, 0); // persist until manually dismissed
  }

  try {
    // Send the update request based on whether reportId is provided
    let response;
    if (data.report_ids?.length > 0) {
      response = await api.put("/reports", data);
    } else {
      response = await api.put(`/reports/${reportId}`, data);
    }
    return response.data;
  } finally {
    // Dismiss the loading message when the request is done
    if (hide) {
      hide();
    }
  }
};

const useUpdateReport = () => {
  const queryClient = useQueryClient();
  const { user } = useContext(UserContext);
  const { id } = user;

  return useMutation(updateReport, {
    onSuccess: (success, data) => {
      if (data.updateStatus) {
        // Invalidate related queries after successful update
        queryClient.invalidateQueries([
          "lesson--report",
          data.lessonOccurrenceId,
        ]);

        queryClient.invalidateQueries([
          "invoice--student-report",
          data.invoiceId,
          data.studentId,
        ]);
        queryClient.invalidateQueries(["report", data.reportId]);
      }
      queryClient.invalidateQueries(["reports", id]);
      queryClient.invalidateQueries(["invoices", id]);
      queryClient.invalidateQueries(["invoice--lessons", data.invoiceId]);
      if (data.successMessage) {
        message.success(data.successMessage);
      }
    },
    onError: (error) => {
      message.error(
        error.response?.data?.message ||
          "An error was encountered. Please try again later."
      );
    },
  });
};

export default useUpdateReport;
