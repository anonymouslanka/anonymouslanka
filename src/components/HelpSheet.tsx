import { Link } from 'react-router-dom';
import { Icon, IconName } from './Icon';
import { Dialog } from './ui';

const steps: { icon: IconName; title: string; text: string }[] = [
  { icon: 'folderPlus', title: 'Open a case', text: 'Describe what happened and add photos as exhibits. No name, email or phone number — ever.' },
  { icon: 'gavel', title: 'A moderator reviews it', text: 'Nothing is public until it is cleared. You can follow progress in My cases.' },
  { icon: 'chat', title: 'The public adds statements', text: 'Anyone can add statements with photos. Statements go live instantly; abusive ones are hidden after 10 reports.' },
  { icon: 'key', title: 'Your case key', text: 'You get a secret key instead of an account. It is shown once and kept only on your device.' },
];

/** The "?" sheet: a short, plain explanation of the whole app. */
export function HelpSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const link = 'flex min-h-12 items-center justify-between rounded-xl bg-black/5 px-4 text-sm font-bold active:bg-black/10';
  return (
    <Dialog open={open} onClose={onClose} title="About Detective Lanka" size="lg">
      <p className="text-sm text-ink-soft">
        An anonymous, moderated case-file app for Sri Lanka. Report crime, read cleared cases and add what you know — without creating an account or giving any personal details.
      </p>
      <ol className="mt-5 space-y-4">
        {steps.map((s, i) => (
          <li key={s.title} className="flex gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-folder text-[#7a5a14]"><Icon name={s.icon} size={20} /></span>
            <span className="text-sm">
              <strong className="block">{i + 1}. {s.title}</strong>
              <span className="text-ink-soft">{s.text}</span>
            </span>
          </li>
        ))}
      </ol>
      <div className="mt-5 flex gap-2.5 rounded-2xl border border-amber-300 bg-amber-50 p-3.5 text-xs text-amber-900">
        <Icon name="alert" size={18} className="mt-0.5 shrink-0" />
        <p>Not monitored in real time. In an emergency call the police on <strong>119</strong>.</p>
      </div>
      <div className="mt-5 space-y-2">
        <Link to="/about" onClick={onClose} className={link}>Privacy &amp; how we protect you <Icon name="chevronRight" size={18} /></Link>
        <Link to="/guidelines" onClick={onClose} className={link}>Code of conduct <Icon name="chevronRight" size={18} /></Link>
        <Link to="/status" onClick={onClose} className={link}>System status <Icon name="chevronRight" size={18} /></Link>
      </div>
    </Dialog>
  );
}
