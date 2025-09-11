import { useState } from "react";
import PropTypes from "prop-types";
import { Button, Dropdown, Radio, DatePicker, Tooltip, Checkbox } from "antd";
import { Download } from "react-feather";
import useCreateAttendanceReportPDF from "../../hooks/useCreateAttendanceReportPDF.js";
import "./DownloadAttendanceReportMenu.css";

const { RangePicker } = DatePicker;

export default function DownloadAttendanceReportMenu({
  studentId,
  studentName,
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [selectedDateRange, setSelectedDateRange] = useState("week");
  const [customDateRange, setCustomDateRange] = useState(null);
  const [includeIncompleteAttendance, setIncludeIncompleteAttendance] =
    useState(null);

  const createAttendanceReportPDF = useCreateAttendanceReportPDF();

  const handleCreateAttendanceReportPDF = () => {
    let startDate = "";
    let endDate = "";
    const today = new Date();
    if (selectedDateRange == "week") {
      // set startDate and endDate to today (backend handles complete weeks automatically)
      startDate = endDate = today.toISOString();
    } else if (selectedDateRange == "month") {
      // first and last day of current month
      const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
      const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      startDate = firstDay.toISOString();
      endDate = lastDay.toISOString();
    } else {
      startDate = customDateRange[0].format("YYYY-MM-DDTHH:mm:ss");
      endDate = customDateRange[1].format("YYYY-MM-DDTHH:mm:ss");
    }
    createAttendanceReportPDF.mutate({
      student_id: studentId,
      student_name: studentName,
      include_incomplete_attendance: includeIncompleteAttendance,
      start_date: startDate,
      end_date: endDate,
    });
    setMenuOpen(false);
  };

  const items = [
    {
      label: (
        <div
          className="dropdown-container"
          onClick={(e) => e.stopPropagation()}
        >
          <section>
            <p>Date range</p>
            <Radio.Group
              onChange={(e) => setSelectedDateRange(e.target.value)}
              value={selectedDateRange}
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 8,
              }}
            >
              <Radio value="week">This week</Radio>
              <Radio value="month">This month</Radio>
              <Radio value="custom">Choose specific weeks</Radio>
            </Radio.Group>

            {selectedDateRange === "custom" && (
              <RangePicker
                className="form--picker"
                format="DD-MM-YYYY"
                onChange={(date) => setCustomDateRange(date)}
                style={{ maxWidth: "80%" }}
              />
            )}
          </section>
          <section>
            <p>Incomplete attendance</p>
            <Checkbox
              onChange={(e) => setIncludeIncompleteAttendance(e.target.checked)}
            >
              Include lessons without recorded attendance (not recommended)
            </Checkbox>
          </section>
          <Tooltip
            title={
              selectedDateRange === "custom" && customDateRange === null
                ? "Please select a start and end date"
                : ""
            }
          >
            <Button
              type="primary"
              onClick={handleCreateAttendanceReportPDF}
              disabled={
                selectedDateRange === "custom" && customDateRange === null
              }
            >
              Download Attendance Report
            </Button>
          </Tooltip>
        </div>
      ),
    },
  ];

  return (
    <Dropdown
      menu={{ items }}
      trigger={["click"]}
      overlayClassName="dropdown-menu"
      open={menuOpen}
      onOpenChange={setMenuOpen}
    >
      <Button icon={<Download size={15} />}>Attendance Report</Button>
    </Dropdown>
  );
}

DownloadAttendanceReportMenu.propTypes = {
  studentId: PropTypes.number,
  studentName: PropTypes.string,
};
