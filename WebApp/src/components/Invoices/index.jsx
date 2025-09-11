import { useState, useEffect, useContext } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { message, Switch } from "antd";
import useGetInvoices from "../../hooks/useGetInvoices";
import useGetInvoiceReport from "../../hooks/useGetInvoiceReport";
import useUpdateInvoice from "../../hooks/useUpdateInvoice.js";
import useCreateInvoicePDF from "../../hooks/useCreateInvoicePDF.js";
import useCreateReportPDF from "../../hooks/useCreateReportPDF.js";
import ReportModal from "../Reports/ReportModal";
import InvoicesTable from "./InvoicesTable";
import InvoiceDrawer from "./InvoiceDrawer";
import Tabs from "../Tabs.jsx";
import { UserContext } from "../../UserContext";
import "./index.css";

export default function Invoices() {
  const { user } = useContext(UserContext);
  const { role } = user;
  let { invoiceId, studentId } = useParams();

  const navigate = useNavigate();

  const [invoiceView, setInvoiceView] = useState(
    role === "tutor" ? "unsubmitted" : "submitted"
  );
  const [filteredInvoices, setFilteredInvoices] = useState([]);
  const [selectedInvoice, setSelectedInvoice] = useState(
    invoiceId !== undefined ? parseInt(invoiceId) : null
  );
  const [selectedStudentId, setSelectedStudentId] = useState(
    studentId !== undefined ? parseInt(studentId) : null
  );
  const [upcomingInvoicesVisible, setUpcomingInvoicesVisible] = useState(
    localStorage.getItem("educatch_upcomingInvoicesVisible") === "true"
  );

  const { data, isLoading, isError } = useGetInvoices();
  const {
    data: reportData,
    isError: reportDataError,
    isFetching: reportDataFetching,
  } = useGetInvoiceReport(parseInt(invoiceId), selectedStudentId);

  const updateInvoiceMutation = useUpdateInvoice();
  const createInvoicePDF = useCreateInvoicePDF();
  const createReportPDF = useCreateReportPDF();

  const handleCreateInvoicePDF = (invoiceData) => {
    createInvoicePDF.mutate({
      invoice_id: invoiceData.id,
      invoice_title: invoiceData.title,
    });
  };

  const handleOpenInvoice = (invoiceId) => {
    navigate(invoiceId.toString()); // open invoiceId in drawer
  };

  const handleCloseInvoice = () => {
    navigate("/invoices");
  };

  const handleOpenReport = (studentId) => {
    setSelectedStudentId(studentId);
    navigate(
      `student/${studentId}/report?disable_unsubmit=${
        invoiceView === "unsubmitted" || role === "admin" ? "false" : "true"
      }`
    );
  };

  const handleCloseReport = () => {
    setSelectedStudentId(null);
    navigate(`/invoices/${invoiceId}`);
  };

  const handleUpdateInvoiceStatus = ({
    invoiceData = null,
    status = null,
    multipleInvoicesStatus = null,
    selectedInvoices = null,
  }) => {
    updateInvoiceMutation.mutate({
      invoiceId: invoiceData?.id,
      role: role,
      data: {
        status: multipleInvoicesStatus || status,
        invoice_ids: selectedInvoices,
      },
    });
  };

  let invoiceTabs =
    role === "admin"
      ? [
          {
            key: "submitted",
            label: "Submitted",
          },
          {
            key: "paid",
            label: "Paid",
          },
          {
            key: "unsubmitted",
            label: "Unsubmitted",
          },
        ]
      : [
          {
            key: "unsubmitted",
            label: "Unsubmitted",
          },
          {
            key: "submitted",
            label: "Submitted",
          },
          {
            key: "paid",
            label: "Paid",
          },
        ];

  const handleCreateReportPDF = (reportData) => {
    createReportPDF.mutate({
      invoice_id: reportData.invoice_id,
      student_id: reportData.student_id,
      week_short: reportData.week_short,
      student_name: reportData.student_name,
    });
  };

  useEffect(() => {
    if (data) {
      const newFilteredInvoices = data.filter((invoice) => {
        const isUpcoming = new Date(invoice.week) > new Date();

        switch (invoiceView) {
          case "unsubmitted":
            return (
              (invoice.status === "upcoming" ||
                invoice.status === "incomplete" ||
                invoice.status === "ready") &&
              (upcomingInvoicesVisible || !isUpcoming)
            );
          case "submitted":
            return (
              invoice.status === "submitted" &&
              (upcomingInvoicesVisible || !isUpcoming)
            );
          case "paid":
            return (
              invoice.status === "paid" &&
              (upcomingInvoicesVisible || !isUpcoming)
            );
          default:
            return false;
        }
      });
      setFilteredInvoices(newFilteredInvoices);

      if (invoiceId) {
        const currentInvoice = data.find(
          (invoice) => invoice.id === parseInt(invoiceId)
        );
        if (currentInvoice) {
          setSelectedInvoice((prevData) => ({
            ...prevData,
            ...currentInvoice,
          }));
        } else {
          setSelectedInvoice(null);
          navigate("/invoices");
          message.error("Error loading invoice. Please try again later.");
        }
      } else {
        setSelectedInvoice(null);
      }
    }
  }, [data, invoiceView, invoiceId, upcomingInvoicesVisible, navigate]);

  return (
    <>
      <title className="invoices--title">
        <h3>{role === "admin" ? "Invoices" : "Your invoices"}</h3>
        {role === "tutor" && (
          <div className="invoices--switch">
            <span>Show upcoming</span>
            <Switch
              checked={upcomingInvoicesVisible}
              onClick={() =>
                setUpcomingInvoicesVisible((prevData) => {
                  localStorage.setItem(
                    "educatch_upcomingInvoicesVisible",
                    !prevData
                  );
                  return !prevData;
                })
              }
            />
          </div>
        )}
      </title>
      <Tabs items={invoiceTabs} onChange={(key) => setInvoiceView(key)} />
      <main className="invoices--invoice-view">
        <InvoicesTable
          key={invoiceView}
          invoiceView={invoiceView}
          data={filteredInvoices}
          role={role}
          isError={isError}
          isLoading={isLoading}
          handleOpenInvoice={handleOpenInvoice}
          handleUpdateInvoiceStatus={handleUpdateInvoiceStatus}
          handleCreateInvoicePDF={handleCreateInvoicePDF}
        />
      </main>
      <InvoiceDrawer
        open={!!invoiceId}
        role={role}
        data={selectedInvoice ? selectedInvoice : {}}
        onClose={handleCloseInvoice}
        handleOpenReport={handleOpenReport}
        handleUpdateInvoiceStatus={handleUpdateInvoiceStatus}
        handleCreateInvoicePDF={handleCreateInvoicePDF}
      />
      <ReportModal
        open={!!selectedStudentId}
        data={reportData}
        role={role}
        studentId={selectedStudentId}
        onClose={handleCloseReport}
        isFetching={reportDataFetching}
        isError={reportDataError}
        handleCreateReportPDF={handleCreateReportPDF}
      />
    </>
  );
}
