import pack from "@/package.json";

export default function Footer() {
  return (
    <footer className="footer footer-center p-4 text-base-content">
      <aside>
        <p className="text-xs opacity-60">
          Copyright © 2023-{new Date().getFullYear()} v{pack.version} - All
          right reserved by @llaoj License MIT
        </p>
      </aside>
    </footer>
  );
}
