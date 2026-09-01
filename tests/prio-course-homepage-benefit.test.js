import { describe, expect, it } from 'vitest';
import { PLANS } from '../src/constants/plans';

describe('Prio-Kurs-Homepage-Vorteil', () => {
  it('ist in allen Paketen mit Prio-Kursen enthalten', () => {
    const paidPlans = PLANS.filter((plan) => plan.maxPrioCourses > 0);

    expect(paidPlans).toHaveLength(3);
    paidPlans.forEach((plan) => {
      expect(plan.features.map((feature) => feature.text)).toContain(
        'Anbieterhomepage-Link bei jedem hervorgehobenen Kurs'
      );
    });
  });

  it('ist im Basic-Paket nicht als Vorteil aufgeführt', () => {
    const basic = PLANS.find((plan) => plan.id === 'basic');

    expect(basic.features.map((feature) => feature.text)).not.toContain(
      'Anbieterhomepage-Link bei jedem hervorgehobenen Kurs'
    );
  });
});
