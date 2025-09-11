import { useMutation } from "react-query";
import api from "./api";
import { message } from "antd";

const useCreateTimetablePDF = () => {
  const createTimetablePDF = async (data) => {
    const hide = message.loading("Downloading timetable(s)...", 0); // persist until manually closed

    try {
      const response = await api.post(`/timetable-pdf`, data, {
        responseType: "blob",
      });

      // if only downloading one timetable, set filename correctly from backend
      const disposition = response.headers["content-disposition"];
      let filename = "Timetables.zip";
      if (disposition && disposition.includes("filename=")) {
        const match = disposition.match(/filename="(.+)"/);
        if (match?.[1]) {
          filename = match[1];
        }
      }

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", filename);
      document.body.appendChild(link);
      link.click();
      link.remove();

      return { message: "Downloaded timetable(s) successfully", hide };
    } catch (error) {
      error.role = data.role;
      hide(); // close loading message before throwing
      throw error;
    }
  };

  return useMutation(createTimetablePDF, {
    onSuccess: ({ message: successMessage, hide }) => {
      hide(); // close the loading message
      message.success(successMessage);
    },
    onError: (error) => {
      message.error(
        error.response?.data?.message || error.status == 404
          ? `No classes are scheduled for the selected ${error.role}(s) within the chosen time period.`
          : "Error downloading timetable(s). Please try again later."
      );
    },
  });
};

export default useCreateTimetablePDF;
