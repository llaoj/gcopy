export default function Title({
  title,
  subTitle,
}: {
  title: string;
  subTitle?: string;
}) {
  return (
    <>
      <div className="pb-2 text-base font-bold">{title}</div>
      {subTitle && <div className="pb-2 text-sm opacity-70">{subTitle}</div>}
    </>
  );
}
