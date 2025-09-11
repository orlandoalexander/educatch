import { useState } from "react";
import PropTypes from "prop-types";
import { Table, Badge, Space, Button } from "antd";
import "./InvoicesTable.css";

export default function InvoicesTable({
  invoiceView,
  data,
  role,
  isError,
  isLoading,
  handleOpenInvoice,
  handleUpdateInvoiceStatus,
  handleCreateInvoicePDF,
}) {
  const [selectedInvoices, setSelectedInvoices] = useState([]);

  const getBadgeStatus = (status) => {
    switch (status) {
      case "ready":
      case "paid":
      case "submitted":
        return "success";
      case "incomplete":
        return "processing";
      case "upcoming":
        return "error";
      default:
        return "default";
    }
  };

  const statusFilters = [...new Set(data.map((item) => item.status))].map(
    (status) => {
      const item = data.find((d) => d.status === status);
      return {
        text: item.status_text,
        value: status,
      };
    }
  );

  const tutorFilters = [...new Set(data.map((item) => item.tutor_name))].map(
    (tutor_name) => {
      const item = data.find((d) => d.tutor_name === tutor_name);
      return {
        text: item.tutor_name,
        value: tutor_name,
      };
    }
  );

  const weekFilters = [...new Set(data.map((item) => item.week))].map(
    (week) => {
      const item = data.find((d) => d.week === week);
      return {
        text: item.week_short,
        value: week,
      };
    }
  );

  const invoiceFilters = [...new Set(data.map((item) => item.title))].map(
    (title) => ({
      text: title,
      value: title,
    })
  );

  const columns = [
    {
      title: "Invoice",
      dataIndex: "title",
      filters: invoiceFilters,
      onFilter: (value, record) => record.title === value,
      sorter: (a, b) => a.id - b.id,
    },
    {
      title: "Week",
      dataIndex: "week_short",
      filters: weekFilters,
      onFilter: (value, record) => record.week === value,
      sorter: (a, b) => new Date(a.week) - new Date(b.week),
    },
    {
      title: "Status",
      dataIndex: "status_text",

      render: (status_text, record) => (
        <Badge status={getBadgeStatus(record.status)} text={status_text} />
      ),
      filters: statusFilters,
      onFilter: (value, record) => record.status === value,
    },
    {
      title: "",
      align: "right",
      key: "action",
      render: (invoice) => (
        <Space size="middle">
          <a onClick={() => handleOpenInvoice(invoice.id)}>View</a>

          {invoice.status === "ready" ||
          invoice.status === "upcoming" ||
          invoice.status === "incomplete" ? (
            <a
              style={{
                pointerEvents:
                  selectedInvoices.length > 0 ||
                  invoice.status === "upcoming" ||
                  (invoice.status === "incomplete" && role === "tutor")
                    ? "none"
                    : "auto",
                color:
                  selectedInvoices.length > 0 ||
                  invoice.status === "upcoming" ||
                  (invoice.status === "incomplete" && role === "tutor")
                    ? "gray"
                    : "",
              }}
              onClick={
                invoice.status !== "upcoming"
                  ? () =>
                      handleUpdateInvoiceStatus({
                        invoiceData: invoice,
                        status: "submitted",
                      })
                  : null
              }
            >
              {role === "tutor" ? "Submit" : "Mark as submitted"}
            </a>
          ) : null}

          {role === "admin" && invoice.status === "submitted" ? (
            <a
              style={{
                pointerEvents: selectedInvoices.length > 0 ? "none" : "auto",
                color: selectedInvoices.length > 0 ? "gray" : "",
              }}
              onClick={() => {
                handleUpdateInvoiceStatus({
                  invoiceData: invoice,
                  status: "paid",
                });
              }}
            >
              Mark as paid
            </a>
          ) : null}

          {invoice.status === "submitted" ? (
            <a
              style={{
                pointerEvents: selectedInvoices.length > 0 ? "none" : "auto",
                color: selectedInvoices.length > 0 ? "gray" : "",
              }}
              onClick={() => {
                handleUpdateInvoiceStatus({
                  invoiceData: invoice,
                  status: "ready",
                });
              }}
            >
              {role === "tutor" ? "Unsubmit" : "Mark as unsubmitted"}
            </a>
          ) : null}

          {role === "admin" && invoice.status === "paid" ? (
            <a
              style={{
                pointerEvents: selectedInvoices.length > 0 ? "none" : "auto",
                color: selectedInvoices.length > 0 ? "gray" : "",
              }}
              onClick={() =>
                handleUpdateInvoiceStatus({
                  invoiceData: invoice,
                  status: "submitted",
                })
              }
            >
              Mark as unpaid (submitted)
            </a>
          ) : null}

          <a onClick={() => handleCreateInvoicePDF(invoice)}>Download</a>
        </Space>
      ),
    },
  ];

  if (role === "admin") {
    columns.splice(2, 0, {
      title: "Tutor",
      dataIndex: "tutor_name",
      filters: tutorFilters,
      onFilter: (value, record) => record.tutor_name === value,
    });
  }

  if (isError) {
    return (
      <div className="invoices--error">
        Error loading invoices. Please try again later.
      </div>
    );
  }
  return (
    <div>
      <Table
        columns={columns}
        dataSource={data}
        pagination={true}
        loading={isLoading}
        rowSelection={
          role === "admin" || (role === "tutor" && invoiceView !== "paid")
            ? {
                onChange: (selectedInvoiceKeys) => {
                  setSelectedInvoices(selectedInvoiceKeys);
                },
              }
            : undefined
        }
      />
      {selectedInvoices.length > 0 && (
        <>
          {invoiceView === "submitted" && (
            <div style={{ display: "flex" }}>
              {role === "admin" && (
                <Button
                  className="table--add-button"
                  type="primary"
                  onClick={() => {
                    handleUpdateInvoiceStatus({
                      multipleInvoicesStatus: "paid",
                      selectedInvoices,
                    });
                    setSelectedInvoices([]);
                  }}
                >
                  {`Mark ${selectedInvoices.length} selected invoice${
                    selectedInvoices.length > 1 ? "s" : ""
                  } as paid`}
                </Button>
              )}
              <Button
                className="table--add-button"
                type={"primary"}
                onClick={() => {
                  handleUpdateInvoiceStatus({
                    multipleInvoicesStatus: "ready",
                    selectedInvoices,
                  });
                  setSelectedInvoices([]);
                }}
              >
                {role === "tutor"
                  ? `Unsubmit ${selectedInvoices.length} selected invoice${
                      selectedInvoices.length > 1 ? "s" : ""
                    }`
                  : `Mark ${selectedInvoices.length} selected invoice${
                      selectedInvoices.length > 1 ? "s" : ""
                    } as unsubmitted`}
              </Button>
            </div>
          )}
          {(invoiceView === "paid" || invoiceView === "unsubmitted") && (
            <Button
              className="table--add-button"
              type="primary"
              onClick={() => {
                handleUpdateInvoiceStatus({
                  multipleInvoicesStatus: "submitted",
                  selectedInvoices,
                });
                setSelectedInvoices([]);
              }}
            >
              {role === "tutor"
                ? `Submit ${selectedInvoices.length} selected invoice${
                    selectedInvoices.length > 1 ? "s" : ""
                  }`
                : `Mark ${selectedInvoices.length} selected invoice${
                    selectedInvoices.length > 1 ? "s" : ""
                  } as ${
                    invoiceView === "paid" ? "unpaid (submitted)" : "submitted"
                  }`}
            </Button>
          )}
        </>
      )}
    </div>
  );
}

InvoicesTable.propTypes = {
  invoiceView: PropTypes.string,
  role: PropTypes.string,
  isError: PropTypes.bool,
  isLoading: PropTypes.bool,
  data: PropTypes.arrayOf(PropTypes.object),
  handleOpenInvoice: PropTypes.func,
  handleUpdateInvoiceStatus: PropTypes.func,
  handleCreateInvoicePDF: PropTypes.func,
};
