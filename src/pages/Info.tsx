import { useState } from 'react';
import { HelpSheet } from '../components/HelpSheet';
import { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Icon, IconName } from '../components/Icon';
import { usePwa } from '../components/Pwa';
import { EmptyState } from '../components/ui';
import { useT } from '../lib/i18n';
import { Reveal } from '../lib/motion';
import { usePageMeta } from '../lib/util';

function Article({ n, icon, title, children }: { n: number; icon: IconName; title: string; children: ReactNode }) {
  const t = useT();
  return (
    <Reveal>
      <section className="card flex gap-4 p-5">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-folder text-[#7a5a14]"><Icon name={icon} size={20} /></span>
        <div className="min-w-0 space-y-2 text-sm leading-relaxed text-ink-soft">
          <p className="font-mono text-[0.62rem] font-bold tracking-[0.16em] text-[#9b7621] uppercase">{t('Article {n}', { n })}</p>
          <h2 className="font-display text-lg font-bold text-ink">{t(title)}</h2>
          {children}
        </div>
      </section>
    </Reveal>
  );
}

function Page({ title, intro, children }: { title: string; intro: string; children: ReactNode }) {
  const t = useT();
  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="font-display text-3xl font-bold sm:text-4xl">{t(title)}</h1>
      <p className="mt-2 mb-6 text-ink-soft">{t(intro)}</p>
      <div className="space-y-4">{children}</div>
    </div>
  );
}

const ul = 'list-disc space-y-1.5 pl-5';

export function About() {
  const t = useT();
  const [help, setHelp] = useState(false);
  usePageMeta({ title: 'Privacy', description: 'How Detective Lanka protects your anonymity, what it does and does not collect, and the limits of that protection.', path: '/about' });
  const { installable, install, standalone } = usePwa();
  return (
    <Page title="Privacy" intro="Detective Lanka is built so that we know as little about you as possible.">
      <Article n={1} icon="scale" title="Why Detective Lanka exists">
        <p>{t('Some crimes are so serious that the people responsible do not receive the punishment they deserve. Detective Lanka is a place to put those cases on the record, with the facts and the sources.')}</p>
        <p>{t('Anyone can add what they know and say, fully anonymously, what punishment they think would be fair. The aim is an open, respectful public discussion, not harassment, and never violence.')}</p>
        <p>{t('Only recent, serious cases are published. Old cases are closed so the list stays current.')}</p>
      </Article>
      <Article n={2} icon="lock" title="What we never ask for">
        <ul className={ul}>
          <li>{t('No accounts, names, emails, phone numbers or social logins.')}</li>
          <li>{t('No advertising trackers, analytics scripts or device fingerprinting.')}</li>
          <li>{t('IP addresses and device details are not stored with cases or statements, and request logs never include them.')}</li>
          <li>{t('Photos are re-encoded on our server: GPS location, camera model and other embedded data are removed before storage.')}</li>
        </ul>
      </Article>
      <Article n={3} icon="key" title="The case key">
        <p>{t('When you open a case or file a statement we generate a random secret key and show it once. We store only a one-way fingerprint of it. Your device keeps a copy so you can manage the case from here. If you lose the key, nobody, including us, can recover it.')}</p>
        <p>{t('Every case and every statement has its own independent key; one key never unlocks another.')}</p>
      </Article>
      <Article n={4} icon="gavel" title="Moderation">
        <p>{t('Nothing is public until a moderator clears it. Edits go back for review. Moderators never see keys.')}</p>
      </Article>
      <Article n={5} icon="alert" title="Honest limits">
        <p>{t('We cannot make you invisible. Your internet provider, your network, and the services we rely on (hosting, database, image storage, caching) may keep their own technical logs outside our control. If your safety depends on strong anonymity, use a trusted privacy tool such as Tor Browser on a network not linked to you, and avoid details only you would know. Writing style and photo content can also identify people.')}</p>
      </Article>
      <Article n={6} icon="download" title="Install the app">
        <p>{t('Detective Lanka is a full app you can install, no app store needed, and it keeps working offline for case files you have opened.')}</p>
        <ul className={ul}>
          <li><strong>{t('iPhone / iPad:')}</strong> {t('open in Safari → Share → Add to Home Screen.')}</li>
          <li><strong>{t('Android:')}</strong> {t('Chrome menu → Install app (or tap Install below).')}</li>
          <li><strong>{t('Windows / Mac:')}</strong> {t('Chrome or Edge → the install icon in the address bar.')}</li>
        </ul>
        {installable && !standalone && <button className="btn-primary mt-2" onClick={install}><Icon name="download" size={17} /> {t('Install now')}</button>}
        {standalone && <p className="font-semibold text-emerald-700">{t('You are running the installed app.')}</p>}
      </Article>
      <p className="pt-2"><button className="inline-flex items-center gap-1 text-sm font-bold text-brand-700" onClick={() => setHelp(true)}>{t('How Detective Lanka works')} <Icon name="arrowRight" size={16} /></button></p>
      <HelpSheet open={help} onClose={() => setHelp(false)} />
      <p><Link to="/guidelines" className="inline-flex items-center gap-1 text-sm font-bold text-brand-700">{t('Read the code of conduct')} <Icon name="arrowRight" size={16} /></Link></p>
      <p><Link to="/status" className="inline-flex items-center gap-1 text-sm font-bold text-brand-700">{t('Check system status')} <Icon name="arrowRight" size={16} /></Link></p>
    </Page>
  );
}

export function Guidelines() {
  const t = useT();
  usePageMeta({ title: 'Code of conduct', description: 'Rules for opening cases and filing statements on Detective Lanka.', path: '/guidelines' });
  return (
    <Page title="Code of conduct" intro="Case files should help the public, not harass or endanger anyone.">
      <Article n={1} icon="check" title="Do">
        <ul className={ul}>
          <li>{t('Stick to facts you witnessed or can support, and say what is first-hand and what is hearsay.')}</li>
          <li>{t('Include useful details: what happened, where, when, and how others can stay safe.')}</li>
          <li>{t('Report real emergencies to the police on')} <strong>119</strong>. {t('This app is not monitored in real time.')}</li>
        </ul>
      </Article>
      <Article n={2} icon="x" title="Do not">
        <ul className={ul}>
          <li>{t('Publish private data about private individuals: home addresses, phone numbers, ID numbers, family members.')}</li>
          <li>{t('Make accusations you cannot support. False or malicious claims can harm innocent people and may be unlawful.')}</li>
          <li>{t('Incite violence, threaten, or call for vigilante action.')}</li>
          <li>{t('Post sexual content, content involving minors, or anything illegal.')}</li>
        </ul>
      </Article>
      <Article n={3} icon="scale" title="Review">
        <p>{t('Moderators clear, dismiss or redact case files and statements. Dismissed items are never shown publicly, and you can see the reason in “My cases” on the device you used.')}</p>
      </Article>
    </Page>
  );
}

export function NotFound() {
  const t = useT();
  usePageMeta({ title: 'Page not found', noindex: true });
  return <EmptyState icon="search" title={t('File not found')} message={t('The page you are looking for doesn’t exist.')} action={<Link to="/" className="btn-primary">{t('Back to case files')}</Link>} />;
}
