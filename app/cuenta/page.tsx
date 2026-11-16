import { AccountView } from "@/components/account-view";

// Player account (SPEC 14). The proxy only lets a signed-in player in; the
// card itself reads the session from the browser store.
export default function AccountPage() {
  return (
    <div className="av-auth-wrap fade-in">
      <AccountView />
    </div>
  );
}
