import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Market Your Business</h1>
        <p className="text-gray-500 mb-8">Pannello Amministrazione</p>
        <SignIn />
      </div>
    </div>
  );
}
