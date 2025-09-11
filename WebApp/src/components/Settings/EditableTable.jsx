import { useState, useEffect, useRef } from "react";
import PropTypes from "prop-types";
import { Table, Input, Popconfirm, Button, ColorPicker } from "antd";
import { Plus } from "react-feather";
import { debounce } from "lodash";
import { v4 as uuidv4 } from "uuid";
import "./EditableTable.css";
import DownloadAttendanceReportMenu from "./DownloadAttendanceReportMenu";

export default function EditableTable({
  name,
  data,
  addData,
  updateData,
  deleteData,
  isLoading,
  isMutateError,
  isError,
}) {
  const [currentPage, setCurrentPage] = useState(1);
  const [dataSource, setDataSource] = useState(
    data || { columns: [], records: [] }
  );
  const debouncedUpdateData = useRef(
    debounce((data) => {
      updateData(data);
    }, 500)
  ).current;

  const handleUpdateCell = (row) => {
    const updatedData = [...dataSource.records];
    const index = updatedData.findIndex((item) => row.key === item.key);
    const item = updatedData[index];
    updatedData.splice(index, 1, { ...item, ...row });
    setDataSource((prevData) => ({ ...prevData, records: updatedData }));

    const { id, key, ...formattedRow } = row; // exclude id and key from the formatted row
    debouncedUpdateData({ id: row.id, data: formattedRow });
  };

  const handleAdd = async () => {
    const uniqueId = uuidv4();
    const newRecord = {
      key: uniqueId,
      ...dataSource.columns.reduce((acc, column) => {
        acc[column.name] = "";
        if (column.name === "color") {
          acc[column.name] = name === "tutor" ? "Blue" : "Red";
        }
        if (column.name === "rate") {
          acc[column.name] = 20;
        }
        return acc;
      }, {}),
    };

    await addData(newRecord, {
      onSuccess: (addedRecord) => {
        setDataSource((prevData) => {
          const updatedRecords = [
            ...prevData.records,
            { ...newRecord, id: addedRecord.id },
          ];
          const newPage = Math.ceil(updatedRecords.length / 8);
          setCurrentPage(newPage);
          return {
            ...prevData,
            records: updatedRecords,
          };
        });
      },
    });
  };

  const handleDeleteRow = (id) => {
    const updatedRecords = dataSource.records.filter((item) => item.id !== id);
    setDataSource((prevData) => ({
      ...prevData,
      records: updatedRecords,
    }));
    deleteData(id);
  };

  const generateColumns = () => {
    if (!dataSource.columns) return [];
    // generate columns based on the keys of the first record in data
    let generatedColumns = dataSource.columns.map((column) => {
      const name = column.name;
      const display_name = name.replace(/_/g, " ");
      const data_type = column.data_type;
      const isNumber = data_type === "int";
      return {
        title: display_name.charAt(0).toUpperCase() + display_name.slice(1), // capitalize the first letter of the key for the title
        dataIndex: name,
        editable: true,
        sorter: isNumber
          ? (a, b) => a[name] - b[name] // numerical sorting
          : (a, b) => a[name].localeCompare(b[name]), // string sorting
        render: (text, record) =>
          name.toLowerCase() === "color" ? (
            <ColorPicker
              value={text}
              onChangeComplete={(color) =>
                handleUpdateCell({
                  ...record,
                  [name]: color.toHexString(),
                })
              }
            />
          ) : (
            <Input
              value={text}
              onChange={(e) =>
                handleUpdateCell({ ...record, [name]: e.target.value })
              }
            />
          ),
      };
    });

    const nameColumn = generatedColumns?.find(
      (col) => col.dataIndex === "name"
    );
    const rateColumn = generatedColumns.find((col) => col.dataIndex === "rate");
    if (rateColumn) rateColumn.title = "Hourly rate (£)";

    const accountNumberColumn = generatedColumns.find(
      (col) => col.dataIndex === "account_number"
    );
    if (accountNumberColumn) accountNumberColumn.title = "Account number";

    const sortCodeColumn = generatedColumns.find(
      (col) => col.dataIndex === "sort_code"
    );
    if (sortCodeColumn) sortCodeColumn.title = "Sort code";

    const colorColumn = generatedColumns.find(
      (col) => col.dataIndex === "color"
    );
    const otherColumns = generatedColumns.filter(
      (col) =>
        col.dataIndex !== "name" &&
        col.dataIndex !== "color" &&
        col.dataIndex !== "rate" &&
        col.dataIndex !== "sort_code" &&
        col.dataIndex !== "account_number"
    );

    generatedColumns = [
      ...(nameColumn ? [nameColumn] : []),
      ...otherColumns,
      ...(rateColumn ? [rateColumn] : []),
      ...(accountNumberColumn ? [accountNumberColumn] : []),
      ...(sortCodeColumn ? [sortCodeColumn] : []),
      ...(colorColumn ? [colorColumn] : []),
    ];

    const downloadColumn = {
      dataIndex: "action",
      render: (_, record) =>
        dataSource.records.length >= 1 ? (
          <DownloadAttendanceReportMenu
            studentId={record.id}
            studentName={record.name}
          />
        ) : null,
    };

    const deleteColumn = {
      width: 50,
      dataIndex: "action",
      render: (_, record) =>
        dataSource.records.length >= 1 ? (
          <Popconfirm
            title={`Delete ${name}${record.name ? ` '${record.name}'` : ""}?`}
            okText="Yes"
            onConfirm={() => handleDeleteRow(record.id)}
          >
            <a>Delete</a>
          </Popconfirm>
        ) : null,
    };

    return [
      ...generatedColumns,
      ...(name === "student" ? [downloadColumn] : []),
      deleteColumn,
    ];
  };

  useEffect(() => {
    if (
      data &&
      (dataSource.columns.length === 0 ||
        (data?.records.length !== dataSource?.records.length && isMutateError))
    )
      setDataSource(data);
  }, [data, dataSource, isMutateError]);

  if (isError) {
    return (
      <div className="table--error">
        {`Error loading ${name}. Please try again later.`}
      </div>
    );
  }

  return (
    <div>
      <Table
        bordered
        dataSource={dataSource.records}
        loading={isLoading}
        columns={generateColumns()}
        pagination={{
          pageSize: 8,
          current: currentPage,
          onChange: (page) => setCurrentPage(page),
        }}
      />
      <Button
        onClick={handleAdd}
        type="primary"
        icon={<Plus />}
        className="table--add-button "
      >
        {`Add ${name}`}
      </Button>
    </div>
  );
}

EditableTable.propTypes = {
  name: PropTypes.string,
  data: PropTypes.object,
  addData: PropTypes.func,
  updateData: PropTypes.func,
  deleteData: PropTypes.func,
  isError: PropTypes.bool,
  isLoading: PropTypes.bool,
  isMutateError: PropTypes.bool,
};
