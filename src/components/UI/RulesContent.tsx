import { useI18n } from '../../i18n';

interface RulesContentProps {
  className?: string;
}

export default function RulesContent({ className }: RulesContentProps) {
  const { t } = useI18n();

  return (
    <div className={className ?? 'space-y-6 text-gray-700 dark:text-gray-300'}>
      <section>
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
          {t.goalTitle}
        </h2>
        <p>{t.goalLead}</p>
        <ul className="list-disc list-inside ml-4 mt-2">
          <li>{t.goal1}</li>
          <li>{t.goal2}</li>
          <li>{t.goal3}</li>
          <li>{t.goal4}</li>
        </ul>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
          {t.flowTitle}
        </h2>
        <p className="mb-2">{t.flowLead}</p>

        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg mb-3">
          <h3 className="font-semibold mb-2">{t.flowPlacementTitle}</h3>
          <ol className="list-decimal list-inside space-y-1">
            <li>{t.flowPlace1}</li>
            <li>{t.flowPlace2}</li>
            <li>{t.flowPlace3}</li>
          </ol>
        </div>

        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg">
          <h3 className="font-semibold mb-2">{t.flowCaptureTitle}</h3>
          <p>{t.flowCaptureLead}</p>
          <ul className="list-disc list-inside mt-2 space-y-1">
            <li>{t.flowCapture1}</li>
            <li>{t.flowCapture2}</li>
            <li>{t.flowCapture3}</li>
          </ul>
        </div>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
          {t.reserveTitle}
        </h2>
        <p>
          {t.reserveText1} <strong>{t.reserveText2}</strong>:
          {' '}{t.reserveCounts}
        </p>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
          {t.reserveSectionTitle}
        </h2>
        <p>
          {t.reserveSectionText1}
          {' '}
          {t.reserveSectionText2}
        </p>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
          {t.freeRingTitle}
        </h2>
        <p>{t.freeRingLead}</p>
        <ul className="list-disc list-inside ml-4 mt-2">
          <li>{t.freeRing1}</li>
          <li>{t.freeRing2}</li>
        </ul>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
          {t.isolationTitle}
        </h2>
        <p>
          {t.isolationText1}
          {' '}
          {t.isolationText2}
        </p>
      </section>
    </div>
  );
}
