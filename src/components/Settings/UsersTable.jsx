import { useState } from "react";
import PropTypes from "prop-types";
import { Table, Cascader } from "antd";
import useGetRoles from "../../hooks/useGetRoles";
import useUpdateUser from "../../hooks/useUpdateUser";

export default function UsersTable({ data, isError, isLoading }) {
  const [updatedRoles, setUpdatedRoles] = useState({});
  const updateUser = useUpdateUser();
  const { data: rolesData, isLoading: rolesDataLoading } = useGetRoles();

  const handleUpdateUser = (userId, data) => {
    setUpdatedRoles({ ...updatedRoles, [userId]: data });
    updateUser.mutate({
      userId,
      data: { role: data ? data[0] : null, role_id: data ? data[1] : null },
    });
  };

  const columns = [
    {
      title: "Email",
      dataIndex: "email",
      sorter: (a, b) => a.name.localeCompare(b.name),
    },
    {
      title: "Name",
      dataIndex: "name",
      sorter: (a, b) => a.name.localeCompare(b.name),
    },
    {
      title: "Role",
      dataIndex: "role",
      render: (_, record) => (
        <Cascader
          loading={rolesDataLoading}
          options={rolesData}
          style={{ width: "220px" }}
          value={
            record.id in (updatedRoles || {})
              ? updatedRoles[record.id]
              : record.role
              ? record.role === "admin"
                ? [record.role]
                : [record.role, record.role_id]
              : []
          }
          onChange={(value) => handleUpdateUser(record.id, value)}
          placeholder="Select role"
        />
      ),
    },
  ];

  if (isError) {
    return (
      <div className="users--error">
        Error loading users. Please try again later.
      </div>
    );
  }

  return (
    <Table
      columns={columns}
      dataSource={data}
      pagination={true}
      loading={isLoading}
    />
  );
}

UsersTable.propTypes = {
  isError: PropTypes.bool,
  isLoading: PropTypes.bool,
  data: PropTypes.arrayOf(PropTypes.object),
};
