import { useState } from "react";
import { UsersPageMeta } from "../components/UsersPageMeta.jsx";
import { UnitMembers } from "./UnitMembers.jsx";
import { useAdminAuth } from "../AdminContext.jsx";

/** Sub-unit leader: approved members in their sub-unit only. */
export function SubUnitUsers({ units }) {
  const { admin: me } = useAdminAuth();
  const unitName = me?.service_unit_name || "your service unit";
  const subUnit = me?.sub_unit_name || "your sub-unit";
  const [memberTotal, setMemberTotal] = useState(0);

  return (
    <>
      <header className="sa-users-page-head">
        <div className="sa-users-page-head-top">
          <h1 className="sa-admins-title">Users</h1>
        </div>
        <UsersPageMeta
          items={[
            `Unit members: ${memberTotal} approved in ${subUnit}`,
            unitName ? `Service unit: ${unitName}` : null,
          ]}
        />
      </header>

      <UnitMembers units={units} embedded subUnitLeaderGeo onMemberStats={({ total }) => setMemberTotal(total)} />
    </>
  );
}
