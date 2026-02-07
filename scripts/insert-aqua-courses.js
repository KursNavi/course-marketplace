import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://nplxmpfasgpumpiddjfl.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseKey) {
  console.error('ERROR: SUPABASE_SERVICE_KEY environment variable required');
  console.log('\nUsage: SUPABASE_SERVICE_KEY=your_service_role_key node scripts/insert-aqua-courses.js');
  console.log('\nYou can find your service role key in Supabase Dashboard > Settings > API');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const courses = [
  {
    title: 'AquaMama – Fitness in der Schwangerschaft',
    description: `AquaMama ist ein spezialisiertes Bewegungsprogramm im Wasser, das exakt auf die körperlichen Bedürfnisse während der Schwangerschaft zugeschnitten ist.

Das Training nutzt den natürlichen Auftrieb des Wassers, um das mit fortschreitender Schwangerschaft zunehmende Körpergewicht abzufangen und so den Rücken, die Bandscheiben sowie die Gelenke der werdenden Mutter spürbar zu entlasten.

Die Übungen kombinieren ein sanftes Herz-Kreislauf-Training mit gezielten Kräftigungseinheiten für den gesamten Körper, wobei ein besonderer Fokus auf der Beweglichkeit und der Vorbereitung auf die Geburt liegt. Durch den Wasserdruck wird zudem der Rückstrom des Blutes zum Herzen unterstützt, was Schwellungen in den Beinen entgegenwirken kann.

Neben dem physischen Aspekt bietet das warme Wasser einen Raum für Entspannung und fördert das allgemeine Wohlbefinden sowie die Bindung zum ungeborenen Kind. Der Kurs dient als ideale Ergänzung zur klassischen Geburtsvorbereitung an Land und ermöglicht den Austausch mit anderen Schwangeren in einem geschützten, professionell geleiteten Rahmen.

Die Bewegungen im Wasser fühlen sich leicht an, fördern die Durchblutung und helfen dabei, die Fitness bis zur Entbindung aufrechtzuerhalten, ohne den Körper zu überfordern.`,
    objectives: [
      'Entlastung der Wirbelsäule und der Gelenke durch den Wasserauftrieb',
      'Sanfte Kräftigung der Rumpf- und Beckenmuskulatur',
      'Förderung der Durchblutung und Reduktion von Wassereinlagerungen',
      'Verbesserung der Atemtechnik und Entspannungsfähigkeit für die Geburt'
    ],
    prerequisites: 'Ab der 15. Schwangerschaftswoche empfohlen; Rücksprache mit der Hebamme oder dem Gynäkologen ist sinnvoll.',
    keywords: 'Schwangerschaft, Aqua-Fitness, Pränatal, Wassergymnastik, Geburtsvorbereitung, Rückenschmerzen, Fitness für Schwangere, Entspannung, Gesundheit, Wasserübungen, Wellness, AquaMama',
    category_type: 'privat_hobby',
    category_area: 'sport_fitness',
    category_specialty: 'Wassersport',
    level: 'all_levels',
    languages: ['Deutsch'],
    price: null,
    session_count: 6,
    session_length: '45-60 Min',
    provider_url: 'https://aquafit4you.ch/aqua-mama/',
    delivery_types: ['presence'],
    booking_type: 'lead',
    canton: 'Zürich',
    user_id: 'd4625bb5-dde6-4899-91c7-b0f9b1bb6473',
    status: 'draft',
    is_pro: false,
    is_prio: false
  },
  {
    title: 'Aqua Yoga',
    description: `Aqua Yoga überträgt die klassischen Prinzipien des Yoga in das Element Wasser und schafft dadurch eine völlig neue Erfahrung von Balance und Kraft.

Durch den Widerstand des Wassers wird für die Ausführung der Asanas eine deutlich höhere Muskelaktivität benötigt als an Land, während gleichzeitig der Auftrieb dabei hilft, komplexe Halteübungen gelenkschonender durchzuführen.

Der Fokus dieses Kurses liegt auf der Verbesserung der Körperwahrnehmung, der Verfeinerung der Körperspannung und der bewussten Verbindung von Bewegung und Atmung. Die Übungen werden im stehtiefen Wasser absolviert, was zusätzliche Sicherheit gibt und den Einsatz von Hilfsmitteln ermöglicht.

Aqua Yoga wirkt besonders harmonisierend auf das Nervensystem und hilft dabei, mentalen Stress abzubauen, während die tiefliegende Muskulatur effektiv gestärkt wird. Durch die langsame, kontrollierte Ausführung der Bewegungen im warmen Wasser entsteht ein tiefer Entspannungseffekt, der weit über die Kursstunde hinaus anhält.

Dieses Angebot eignet sich sowohl für Yoga-Neulinge, die einen sanften Einstieg suchen, als auch für Fortgeschrittene, die ihre Praxis durch die physikalischen Herausforderungen des Wassers erweitern möchten.`,
    objectives: [
      'Verbesserung der Balance und Koordination im Wasser',
      'Stärkung der tiefliegenden Stützmuskulatur',
      'Förderung der Flexibilität durch sanftes Stretching',
      'Stressabbau durch bewusste Atemführung'
    ],
    prerequisites: 'Keine formalen Voraussetzungen',
    keywords: 'Yoga, Wasser-Yoga, Entspannung, Körperwahrnehmung, Achtsamkeit, Aqua-Fitness, Stretching, Balance, Mentale Gesundheit, Gelenkschonend, Ganzkörpertraining, Wellness, Aqua Yoga',
    category_type: 'privat_hobby',
    category_area: 'sport_fitness',
    category_specialty: 'Wassersport',
    level: 'all_levels',
    languages: ['Deutsch'],
    price: null,
    session_count: null,
    session_length: '45-60 Min',
    provider_url: 'https://aquafit4you.ch/aqua-yoga/',
    delivery_types: ['presence'],
    booking_type: 'lead',
    canton: 'Zürich',
    user_id: 'd4625bb5-dde6-4899-91c7-b0f9b1bb6473',
    status: 'draft',
    is_pro: false,
    is_prio: false
  },
  {
    title: 'Aqua Pilates',
    description: `Aqua Pilates kombiniert die präzisen Kräftigungsmethoden des klassischen Pilates mit der dynamischen Kraft des Wassers.

Im Zentrum des Trainings steht das "Powerhouse" – die Aktivierung der tiefen Bauch-, Rücken- und Beckenbodenmuskulatur. Durch die Instabilität des Wassers wird der Körper ständig dazu gefordert, kleine Ausgleichsbewegungen zu machen, was die Koordination und die Feinstabilität der Wirbelsäule massiv verbessert.

Der Kurs bietet zwei verschiedene Ansätze: Während "AquaPilates CLASSIC" auf die Kräftigung und Haltung abzielt, fokussiert "AquaPilates AI CHI" auf langsame, fliessende Bewegungen zur Förderung der inneren Ruhe und Entspannung.

Die Übungen werden kontrolliert und in Verbindung mit einer spezifischen Atemtechnik ausgeführt, was die Konzentrationsfähigkeit schult und zu einer verbesserten Körperhaltung führt. Da das Wasser die Gelenke entlastet, können auch Personen mit Rückenbeschwerden oder körperlichen Einschränkungen effektiv trainieren.

Aqua Pilates ist somit ein ideales Ganzkörpertraining für alle Altersgruppen, die Wert auf eine starke Mitte und eine gesunde Körperstatik legen, ohne dabei die Gelenke unnötig zu belasten.`,
    objectives: [
      'Stärkung des Powerhouse (Rumpfstabilität)',
      'Verbesserung der Körperhaltung und Wirbelsäulenmobilität',
      'Förderung der Konzentration und Atemkontrolle',
      'Steigerung der muskulären Ausdauer'
    ],
    prerequisites: 'Keine formalen Voraussetzungen',
    keywords: 'Pilates, Aqua Pilates, Rumpfstabilität, Beckenboden, Rückentraining, Haltungskorrektur, Core-Training, Kraftausdauer, Ai Chi, Gelenkschonend, Fitness, Gesundheit, Aqua-Fitness',
    category_type: 'privat_hobby',
    category_area: 'sport_fitness',
    category_specialty: 'Wassersport',
    level: 'all_levels',
    languages: ['Deutsch'],
    price: null,
    session_count: null,
    session_length: '45-60 Min',
    provider_url: 'https://aquafit4you.ch/aqua-pilates/',
    delivery_types: ['presence'],
    booking_type: 'lead',
    canton: 'Zürich',
    user_id: 'd4625bb5-dde6-4899-91c7-b0f9b1bb6473',
    status: 'draft',
    is_pro: false,
    is_prio: false
  }
];

async function insertCourses() {
  console.log('Inserting 3 AquaFit4You courses...\n');

  for (const course of courses) {
    const { data, error } = await supabase
      .from('courses')
      .insert(course)
      .select('id, title');

    if (error) {
      console.error(`ERROR inserting "${course.title}":`, error.message);
    } else {
      console.log(`OK: "${data[0].title}" (ID: ${data[0].id})`);
    }
  }

  console.log('\nDone! Courses are in "draft" status.');
  console.log('To publish, run in Supabase SQL Editor:');
  console.log(`UPDATE courses SET status = 'published' WHERE user_id = 'd4625bb5-dde6-4899-91c7-b0f9b1bb6473' AND status = 'draft';`);
}

insertCourses();
