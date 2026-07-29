export const dynamic = "force-dynamic";
import { UserProfile } from "@clerk/nextjs";

export default function ProfilePage() {
  return (
    <div className="max-w-[900px]">
      <div className="mb-7">
        <h1 className="text-[24px] font-semibold" style={{ color: "var(--fg)", letterSpacing: "-0.02em" }}>
          Il tuo profilo
        </h1>
        <p className="text-[13px] mt-0.5" style={{ color: "var(--fg-3)" }}>
          Foto, informazioni personali, password e sicurezza dell&apos;account
        </p>
      </div>
      <UserProfile />
    </div>
  );
}
