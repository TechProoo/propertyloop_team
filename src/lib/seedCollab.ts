// Seed data for the collaboration features — daily logs and messaging.
//
// Split from seed.ts because it is a different kind of data: seed.ts is the
// commercial record (properties, deals, leads), this is what people wrote to
// each other. Same rule applies — every word here is invented.

import { STAFF } from './seed'
import { ALL_STAFF_CHANNEL_ID } from './types'
import type { Channel, ChatMessage, DailyLog } from './types'

const DAY = 86_400_000

function daysAgo(n: number, hour = 10): string {
  const d = new Date(Date.now() - n * DAY)
  d.setHours(hour, (n * 7) % 60, 0, 0)
  return d.toISOString()
}

function hoursAgo(n: number): string {
  return new Date(Date.now() - n * 3_600_000).toISOString()
}

/** Local calendar day, n days back — must match format.isoDate. */
function dayKey(offset: number): string {
  const d = new Date(Date.now() - offset * DAY)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/* ─── Daily logs ─────────────────────────────────────────────────────── */

function log(
  staffId: string,
  offset: number,
  summary: string,
  blockers: string,
  plan: string,
): DailyLog {
  return {
    id: `log-${staffId}-${offset}`,
    staffId,
    date: dayKey(offset),
    summary,
    blockers,
    plan,
    submittedAt: daysAgo(offset, 17),
    updatedAt: daysAgo(offset, 17),
  }
}

// Deliberately uneven — some people file every day, some skip. The gaps are
// the point of the manager view.
export const DAILY_LOGS: DailyLog[] = [
  log(
    'staff-c-ola',
    1,
    'Photographed the two remaining Cedarwood terraces and uploaded 18 images. Chased Greenfield for the Phase 3 receipt. Verified documents on the VI serviced apartment.',
    'Cedarwood still have not sent the building permit for Phase 2 block C.',
    'Publish the VI apartment and start on the Ajah flat documents.',
  ),
  log(
    'staff-c-ola',
    2,
    'Site visit to Ikate with the Greenfield sales lead. Collected pricing for 8 units and took survey plan copies.',
    'None.',
    'Upload the Greenfield pricing and photograph the show unit.',
  ),
  log(
    'staff-c-ola',
    3,
    'Cleared the pending review queue for Lekki. Three listings published, one held for a missing C of O.',
    'Need a decision on whether shortlets require a building permit — holding two listings on this.',
    'Follow up the C of O with the owner.',
  ),
  log(
    'staff-c-sodiq1',
    1,
    'Crestview sent through their first batch — 3 photos and a survey plan only. Logged the listing and raised a thread rather than publishing it.',
    'Crestview have no C of O on file. Waiting on the GM to raise it with their contact.',
    'Chase Crestview and start on the Lekki County mansion photos.',
  ),
  log(
    'staff-c-sodiq1',
    3,
    'Called four developers from the Lekki list. Two asked for the partnership deck, one declined, one no answer.',
    'The partnership deck is out of date — it still shows the old commission structure.',
    'Send the decks once Marketing has updated them.',
  ),
  log(
    'staff-e-ngozi',
    1,
    'Cleared 14 enquiries. Two arrived after hours and were answered this morning, which put them over the 30 minute SLA. Onboarded the three Beacon Realty agents.',
    'Enquiries arriving between 7pm and 8am cannot be answered inside 30 minutes by one person. This needs a written rule.',
    'Work through the KYC queue for Marble & Stone.',
  ),
  log(
    'staff-e-ngozi',
    2,
    'Handled the Lagoon View facility management proposal follow-up. Updated commission tracking for the two closed deals.',
    'None.',
    'Chase Lagoon View for a decision.',
  ),
  log(
    'staff-e-ngozi',
    3,
    'Complaint from a shortlet guest resolved the same day. Cleared 11 enquiries.',
    'Still no owner for the vendor payout queue — two payouts have been sitting for days.',
    'Raise payout ownership at the Monday check-in.',
  ),
  log(
    'staff-b',
    1,
    'Met Alaro Court. They have given inventory on 16 units but will not commit to exclusive before their Thursday meeting with a competitor. Offered the co-branded launch campaign against an exclusive only.',
    'Sterling Heights have gone quiet since the site visit. The decision maker is their MD, not our contact.',
    'Wednesday morning meeting with Alaro to get ahead of the competitor.',
  ),
  log(
    'staff-b',
    2,
    'Two advertising package conversations — Zenith Lekki want homepage placement plus WhatsApp Channel mentions. Reviewed the team pipeline.',
    'Marketing and I are still counting qualified leads differently, so my conversion denominator moves week to week.',
    'Settle the qualified-lead definition with Marketing and the MD.',
  ),
  log(
    'staff-d',
    1,
    'Published the Lagos rent price index carousel. Scheduled the escrow explainer graphic. Campaign reporting for the Q4 buyer push — 48 leads attributed.',
    'The Banana Island teaser is blocked on the 60 second vertical cut.',
    'Brief the Osun launch content.',
  ),
  log(
    'staff-d',
    4,
    'Weekly digest to the WhatsApp Channel — the best performing piece this month at 8.9% engagement and 31 leads.',
    'None.',
    'Plan the second structured campaign for the month.',
  ),
  log(
    'staff-f',
    1,
    'Filmed the Cedarwood 5-bed. Recorded a shorter voiceover for the Banana Island 60 second cut.',
    'The Osogbo trip needs confirming — I cannot hit the video count if the Osun shoots slip into next month.',
    'Ikoyi shortlet reel.',
  ),
  log(
    'staff-f',
    3,
    'Two walkthroughs filmed back to back in Ikate. Both first takes, no reshoots needed.',
    'None.',
    'Editing handover to Marketing.',
  ),
  log(
    'staff-g',
    1,
    'Prepped the escrow explainer shoot — script, location and property documents ready a day ahead. Confirmed the Ikoyi schedule.',
    'The Osogbo trip cannot be scheduled until travel is approved.',
    'Prep the Ikoyi shortlet shoot and confirm the Osun dates.',
  ),
  log(
    'staff-g',
    2,
    'Filing and correspondence. Chased three outstanding property document copies for the listings team.',
    'None.',
    'Prep the escrow explainer.',
  ),
  log(
    'staff-sodiq2',
    1,
    'Osun Grove Block B listing created. Photographed two units, six still outstanding. Met Ile-Ife Property Partners about the commission split.',
    'Cannot complete the Osogbo listings without a second day on site. Waiting on the Lagos trip being confirmed.',
    'Finish the Block B documents.',
  ),
  log(
    'staff-sodiq2',
    2,
    'Osogbo GRA duplex published — all four documents verified. First fully complete Osun listing.',
    'None.',
    'Start on the remaining Osun Grove units.',
  ),
  log(
    'staff-a',
    2,
    'Greenfield monthly review — 6 units sold through the platform. Opened the MTN brand conversation through a Cedarwood introduction.',
    'Revenue is tracking behind target for the month and rests on two people closing.',
    'Push the Banana Island negotiation to a decision.',
  ),
]

/* ─── Channels ───────────────────────────────────────────────────────── */

function msg(id: string, authorId: string, text: string, hours: number): ChatMessage {
  return { id, authorId, text, createdAt: hoursAgo(hours) }
}

// Everyone is in the all-staff channel. Direct channels are seeded only where
// there is a conversation worth showing; the rest are created on demand when
// somebody starts one.
export const CHANNELS: Channel[] = [
  {
    id: ALL_STAFF_CHANNEL_ID,
    kind: 'GROUP',
    name: 'All staff',
    memberIds: STAFF.map((s) => s.id),
    createdAt: daysAgo(60),
    lastReadAt: {},
    messages: [
      msg(
        'cm-1',
        'staff-a',
        'Morning everyone. Reminder that the monthly review is Monday. Please have your daily logs filed before then — I will be reading those, not summaries.',
        52,
      ),
      msg(
        'cm-2',
        'staff-b',
        'Adding to that: bring one bottleneck each, not a list of activities. If something is blocking you it goes in the blockers field.',
        50,
      ),
      msg(
        'cm-3',
        'staff-e-ngozi',
        'Mine will say what it has said all week — nobody owns the vendor payout queue. Two payouts are still sitting unpaid.',
        48,
      ),
      msg(
        'cm-4',
        'staff-a',
        'Noted, and that is a fair escalation. I will take the payout queue personally until we assign it properly.',
        47,
      ),
      msg(
        'cm-5',
        'staff-d',
        'Osun launch content is briefed. If the Ambassador travels with the listings team we get the video on the same trip instead of paying for two.',
        26,
      ),
      msg(
        'cm-6',
        'staff-b',
        'Approved. Secretary, please coordinate the dates so it lands before month end.',
        25,
      ),
      msg(
        'cm-7',
        'staff-g',
        'On it. I will confirm travel today and circulate the schedule.',
        24,
      ),
      msg(
        'cm-8',
        'staff-c-ola',
        'Three listings published in Lekki this morning. One held — missing C of O.',
        6,
      ),
    ],
  },
  {
    id: 'channel-dm-b-ola',
    kind: 'DIRECT',
    name: null,
    memberIds: ['staff-b', 'staff-c-ola'],
    createdAt: daysAgo(20),
    lastReadAt: {},
    messages: [
      msg('cm-20', 'staff-b', 'How many Cedarwood units are actually live now?', 30),
      msg(
        'cm-21',
        'staff-c-ola',
        'Two published, both fully documented. The 5-bed went live yesterday.',
        29,
      ),
      msg(
        'cm-22',
        'staff-b',
        'Good. I am telling Cedarwood we have moved on Phase 2 — I need that to be true when they check.',
        29,
      ),
      msg('cm-23', 'staff-c-ola', 'It is. You can send them the links.', 28),
    ],
  },
  {
    id: 'channel-dm-ngozi-b',
    kind: 'DIRECT',
    name: null,
    memberIds: ['staff-e-ngozi', 'staff-b'],
    createdAt: daysAgo(9),
    lastReadAt: {},
    messages: [
      msg(
        'cm-30',
        'staff-e-ngozi',
        'The 30 minute SLA is not achievable as written. Enquiries arrive at 9pm on a Sunday and I am one person.',
        20,
      ),
      msg(
        'cm-31',
        'staff-b',
        'Understood. Propose working hours and I will take it to the MD. What is realistic?',
        19,
      ),
      msg(
        'cm-32',
        'staff-e-ngozi',
        '8am to 6pm Monday to Saturday. 30 minutes inside those hours, first thing next morning outside them. Anything tighter needs a second person.',
        4,
      ),
    ],
  },
  {
    id: 'channel-dm-f-g',
    kind: 'DIRECT',
    name: null,
    memberIds: ['staff-f', 'staff-g'],
    createdAt: daysAgo(14),
    lastReadAt: {},
    messages: [
      msg(
        'cm-40',
        'staff-g',
        'Escrow explainer script is in your folder. Location is the office.',
        8,
      ),
      msg(
        'cm-41',
        'staff-f',
        'Read it. Can we cut the second paragraph? It is too long to say naturally.',
        7,
      ),
      msg(
        'cm-42',
        'staff-g',
        'Cut. Updated version uploaded, and the shoot is prepped for tomorrow.',
        6,
      ),
    ],
  },
  {
    id: 'channel-dm-sodiqs',
    kind: 'DIRECT',
    name: null,
    memberIds: ['staff-c-sodiq1', 'staff-sodiq2'],
    createdAt: daysAgo(7),
    lastReadAt: {},
    messages: [
      msg(
        'cm-50',
        'staff-sodiq2',
        'Six units still need photographing at Osun Grove. Are you coming Thursday or Friday?',
        22,
      ),
      msg(
        'cm-51',
        'staff-c-sodiq1',
        'Both days if travel is approved. We should shoot everything in one trip.',
        21,
      ),
      msg('cm-52', 'staff-sodiq2', 'Agreed. I will line up access to all six.', 20),
    ],
  },
]
