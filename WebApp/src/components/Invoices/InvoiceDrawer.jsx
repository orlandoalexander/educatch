import PropTypes from "prop-types";
import { Drawer, Table, Button, Dropdown, Space, Tooltip } from "antd";
import { useNavigate } from "react-router-dom";
import { Calendar, X, AlertCircle, DollarSign, Check } from "react-feather";
import useGetInvoiceLessons from "../../hooks/useGetInvoiceLessons";
import "./InvoiceDrawer.css";

export default function InvoiceDrawer({
  role,
  open,
  onClose,
  data,
  handleOpenReport,
  handleUpdateInvoiceStatus,
  handleCreateInvoicePDF,
}) {
  const {
    data: invoiceData,
    isLoading,
    isError,
  } = useGetInvoiceLessons(data?.id);

  const navigate = useNavigate();
  const getLessonItems = (lessons) => {
    return lessons.map((lesson) => ({
      key: lesson.id,
      label: (
        <button
          className="invoice--lessons"
          onClick={() => navigate(`/timetable/${lesson.id}`)}
        >
          {lesson.lesson_time_short}
        </button>
      ),
    }));
  };

  const columns = [
    {
      title: "Student",
      width: 100,
      dataIndex: "student_name",
    },
    {
      title: "Lesson(s)",
      width: 90,
      dataIndex: "lessons",
      render: (lessons) => {
        const items = getLessonItems(lessons);
        return (
          <Dropdown menu={{ items }} placement="bottomLeft">
            <Button>{`${lessons.length} ${
              lessons.length === 1 ? "lesson" : "lessons"
            }`}</Button>
          </Dropdown>
        );
      },
    },
    {
      title: "Hrs",
      width: 50,
      dataIndex: "total_lesson_hours",
    },
    {
      title: "Total",
      width: 50,
      render: (record) => {
        return `£${invoiceData.rate * record.total_lesson_hours}`;
      },
    },
    {
      fixed: "right",
      key: "action",
      width: 80,
      render: (invoice) => (
        <a
          className={`${invoice.reports_status}-icon report-action`}
          onClick={() => handleOpenReport(invoice.student_id)}
        >
          {`View report${invoice.lessons.length > 1 ? "s" : ""}`}
        </a>
      ),
    },
  ];

  return (
    <Drawer
      width={"40%"}
      placement="right"
      closable={false}
      onClose={onClose}
      open={open}
    >
      <main className="invoice">
        <section className="invoice--content">
          <h2 className="invoice--title">{`Invoice ${
            data?.title ? data.title : ""
          }`}</h2>
          {data?.id ? (
            <section className="invoice--details">
              <div>
                <div className="invoice--details-icon calendar-icon">
                  <Calendar size={14} />
                </div>
                <span>{data?.week_short}</span>
              </div>
              <div>
                <div className={`invoice--details-icon ${data?.status}-icon`}>
                  {data?.status === "submitted" || data?.status === "ready" ? (
                    <Check size={14} />
                  ) : data?.status === "incomplete" ||
                    data?.status === "upcoming" ? (
                    <AlertCircle size={14} />
                  ) : (
                    <DollarSign size={14} />
                  )}
                </div>
                <span>{data?.status_text}</span>
              </div>
            </section>
          ) : null}
          {isError ? (
            <div className="invoice--error">
              Error loading lessons. Please try again later.
            </div>
          ) : (
            <>
              <Table
                columns={columns}
                dataSource={invoiceData?.lessons}
                pagination={{
                  pageSize: 4,
                }}
                ellipsis
                bordered
                loading={isLoading}
                scroll={{ x: "max-content" }}
              />

              {!isLoading && (
                <section className="invoice--total">
                  <span>Total</span>
                  <span>
                    £
                    {invoiceData?.lessons?.reduce(
                      (total, lesson) =>
                        total + lesson.total_lesson_hours * invoiceData.rate,
                      0
                    )}
                  </span>
                </section>
              )}
            </>
          )}
        </section>
        <Space className="invoice--buttons">
          <Button
            disabled={data?.status === "upcoming"}
            key="cancel"
            style={{
              outline: "none",
              boxShadow: "none",
            }}
            onClick={() => handleCreateInvoicePDF(data)}
          >
            Download invoice
          </Button>
          {data?.status === "submitted" && role === "admin" && (
            <Button
              type="primary"
              onClick={() =>
                handleUpdateInvoiceStatus({
                  invoiceData: data,
                  status: "paid",
                })
              }
            >
              Mark as paid
            </Button>
          )}
          {(data?.status !== "paid" || role === "admin") && (
            <Tooltip
              placement="topRight"
              title={
                data?.status === "upcoming"
                  ? "Invoice cannot be submitted as it contains upcoming lessons"
                  : role === "tutor" && data?.status === "incomplete"
                  ? "Invoice cannot be submitted yet as it is missing lesson report(s)"
                  : ""
              }
            >
              <Button
                disabled={
                  data?.status === "upcoming" ||
                  (role === "tutor" && data?.status === "incomplete")
                }
                type="primary"
                onClick={() =>
                  handleUpdateInvoiceStatus({
                    invoiceData: data,
                    status: data.status === "submitted" ? "ready" : "submitted",
                  })
                }
              >
                {role === "admin"
                  ? data?.status === "submitted"
                    ? "Mark as unsubmitted"
                    : `Mark as ${
                        data?.status === "paid"
                          ? "unpaid (submitted)"
                          : "submitted"
                      }`
                  : data?.status === "submitted"
                  ? "Unsubmit"
                  : "Submit"}
              </Button>
            </Tooltip>
          )}
        </Space>
      </main>
    </Drawer>
  );
}

InvoiceDrawer.propTypes = {
  role: PropTypes.string,
  open: PropTypes.bool,
  onClose: PropTypes.func,
  data: PropTypes.object,
  handleOpenReport: PropTypes.func,
  handleUpdateInvoiceStatus: PropTypes.func,
  handleCreateInvoicePDF: PropTypes.func,
};
