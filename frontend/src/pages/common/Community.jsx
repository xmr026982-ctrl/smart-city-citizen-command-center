import { useAuth } from "../../store/authStore";
import CitizenCommunity from "../../components/community/CitizenCommunity";
import AdminCommunity from "../../components/community/AdminCommunity";
import StaffCommunity from "../../components/community/StaffCommunity";
import "../../styles/community.css";

/* ------------------------------------------------------------------
   Community, one route for every role:
     citizen  the zone board (proposals, polls, announcements, fixed)
     admin    Community Command
     staff    the zone board for field crews (work notices, checks)
------------------------------------------------------------------- */
export default function Community() {
  const me = useAuth();
  if (me?.role === "citizen") return <CitizenCommunity />;
  if (me?.role === "admin") return <AdminCommunity />;
  return <StaffCommunity />;
}