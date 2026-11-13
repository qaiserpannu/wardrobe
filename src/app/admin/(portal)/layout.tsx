import { AdminShell } from "@/components/admin/AdminShell";

export default function PortalLayout({ children }: LayoutProps<"/admin">) {
  return <AdminShell>{children}</AdminShell>;
}
