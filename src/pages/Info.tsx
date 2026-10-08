import { Link } from 'react-router-dom';
import { EmptyState } from '../components/ui';
import { usePageMeta } from '../lib/util';

function Page({ title, intro, children }: { title: string; intro: string; children: React.ReactNode }) {
  return (
    <article className="mx-auto max-w-3xl">
      <h1 className="font-display text-3xl font-bold sm:text-4xl">{title}</h1>
      <p className="mt-3 text-lg text-stone-600">{intro}</p>
      <div className="mt-8 space-y-8 [&_h2]:font-display [&_h2]:text-xl [&_h2]:font-semibold [&_li]:mt-2 [&_p]:mt-2 [&_p]:leading-relaxed [&_ul]:list-disc [&_ul]:pl-5">{children}</div>
    </article>
  );
}

export function About() {
  usePageMeta({ title: 'Privacy & how it works', description: 'How Anonymous Lanka protects your anonymity, what we do and do not collect, and the limits of that protection.', path: '/about' });
  return (
    <Page title="Privacy & how it works" intro="Anonymous Lanka is built so that we know as little about you as possible.">
      <section>
        <h2>What we do not collect</h2>
        <ul>
          <li>No accounts, names, emails, phone numbers or social logins.</li>
          <li>No advertising trackers, analytics scripts or device fingerprinting.</li>
          <li>We do not store IP addresses or device information with your posts or comments, and request logs never include them.</li>
          <li>Photos are re-encoded on our server: GPS location, camera model and other embedded metadata are removed before storage.</li>
        </ul>
      </section>
      <section>
        <h2>The edit key</h2>
        <p>When you submit a post or comment, we generate a random secret <em>edit key</em> and show it to you once. We store only a one-way fingerprint of it. Your browser keeps a copy so you can edit or delete from the same device. If you lose the key, nobody — including us — can recover it.</p>
        <p>Every post and every comment has its own independent key; one key never unlocks another item.</p>
      </section>
      <section>
        <h2>Moderation</h2>
        <p>Nothing is public until a moderator approves it. Edits send content back for review. Moderators never see edit keys.</p>
      </section>
      <section>
        <h2>Honest limits</h2>
        <p>We cannot make you invisible. Your internet provider, network, hosting and CDN providers, and the services we rely on (database, image storage, caching) may keep their own technical logs outside our control. If your safety depends on strong anonymity, use a trusted privacy tool such as Tor Browser and a network not linked to you, avoid including details only you would know, and remember writing style and photo content can identify people.</p>
      </section>
      <p><Link to="/guidelines" className="font-semibold text-brand-700 underline">Read the posting guidelines →</Link></p>
    </Page>
  );
}

export function Guidelines() {
  usePageMeta({ title: 'Posting guidelines', description: 'Rules for submitting reports to Anonymous Lanka.', path: '/guidelines' });
  return (
    <Page title="Posting guidelines" intro="Reports should help the public — not harass or endanger anyone.">
      <section>
        <h2>Do</h2>
        <ul>
          <li>Stick to facts you witnessed or can support, and say clearly what is first-hand and what is hearsay.</li>
          <li>Include useful details: what happened, where, when, and how others can stay safe.</li>
          <li>Report real emergencies to the police on <strong>119</strong>. This site is not monitored in real time.</li>
        </ul>
      </section>
      <section>
        <h2>Don’t</h2>
        <ul>
          <li>Publish private data about private individuals: home addresses, phone numbers, national ID numbers, family members.</li>
          <li>Make accusations you cannot support. False or malicious claims can harm innocent people and may be unlawful.</li>
          <li>Incite violence, threaten, or call for vigilante action.</li>
          <li>Post sexual content, content involving minors, or anything illegal.</li>
        </ul>
      </section>
      <section>
        <h2>Review</h2>
        <p>Moderators approve, reject or redact posts. Rejected posts are never shown publicly and you can see the reason from “My posts” on the device you used.</p>
      </section>
    </Page>
  );
}

export function NotFound() {
  usePageMeta({ title: 'Page not found', noindex: true });
  return <EmptyState title="Page not found" message="The page you’re looking for doesn’t exist." action={<Link to="/" className="btn-primary">Go home</Link>} />;
}
