import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://nplxmpfasgpumpiddjfl.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseKey) {
  console.error('ERROR: SUPABASE_SERVICE_KEY environment variable required');
  console.log('\nUsage: SUPABASE_SERVICE_KEY=your_service_role_key node scripts/insert-dog-knowhow-courses.js');
  console.log('\nYou can find your service role key in Supabase Dashboard > Settings > API');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Anbieter UUID: Dog Know-how
const PROVIDER_USER_ID = '65da3c71-8be1-4568-858f-a4ad0e232d45';

const courses = [
  {
    title: 'Welpenkurs – Der optimale Start ins Leben',
    description: `Dieser Kurs legt das Fundament für ein harmonisches Zusammenleben und eine gesunde Entwicklung des jungen Hundes.

In der prägenden Phase zwischen der 8. und 16. Woche ist es entscheidend, den Welpen behutsam an verschiedene Umweltreize, Artgenossen und Menschen heranzuführen. Das Training umfasst kontrollierte Spielsequenzen mit ausgewählten Partnern, um die Sozialkompetenz zu fördern, sowie erste Übungen zur Grunderziehung wie Rückruf, lockere Leine und das Signal zum Entspannen.

Die Teilnehmenden lernen, die Körpersprache ihres Welpen richtig zu deuten und Situationen korrekt einzuschätzen. Ein theoretischer Teil vermittelt Wissen über Stubenreinheit, Beisshemmung und den Umgang mit Ruhephasen.

Zielgruppe sind alle Neuhundehalter und Erfahrene, die ihren Welpen unter fachkundiger Anleitung fördern möchten. Durch kleine Gruppengrössen wird sichergestellt, dass kein Tier überfordert wird und genügend Zeit für individuelle Fragen der Halter bleibt.

Der Kurs bietet einen sicheren Rahmen, um Vertrauen aufzubauen und die Neugier des Welpen in konstruktive Bahnen zu lenken. Am Ende des Kurses verfügen die Halter über ein Repertoire an Werkzeugen, um den Alltag sicher zu meistern und die Basis für weiterführende Erziehungskurse zu bilden.`,
    objectives: [
      'Aufbau einer vertrauensvollen Bindung zwischen Mensch und Welpe',
      'Förderung der Sozialisierung durch kontrollierten Kontakt zu Artgenossen',
      'Erlernen der Grundsignale wie Sitz, Warten und Herankommen',
      'Sensibilisierung für die Körpersprache und Kommunikation des Hundes',
      'Sicherer Umgang mit Umweltreizen und Alltagssituationen'
    ],
    prerequisites: 'Welpen im Alter von ca. 8 bis 16 Wochen, erste Impfungen vorhanden.',
    keywords: 'Welpenförderung, Welpenspiel, Hundeerziehung, Sozialisierung, Welpenschule, Gampelen, Bern, Hundetraining, Grundgehorsam, Bindungsaufbau, Welpenerziehung, Tierhaltung, Welpenkurs',
    category_type: 'privat_hobby',
    category_area: 'heim_garten',
    category_specialty: 'Tiere & Hundeschule',
    category_focus: null,
    level: 'beginner',
    languages: ['Deutsch'],
    price: 210.00,
    session_count: 6,
    session_length: '60 Min',
    provider_url: 'https://dog-knowhow.ch/kurse/welpenkurse/',
    delivery_types: ['presence'],
    booking_type: 'lead',
    canton: 'Bern',
    user_id: PROVIDER_USER_ID,
    status: 'draft',
    is_prio: false
  },
  {
    title: 'Junghundekurs & Erziehungskurs',
    description: `Nach der Welpenzeit folgt die Phase der Pubertät, in der viele bereits gelernte Inhalte scheinbar vergessen werden und die Umwelt für den Hund zunehmend spannender wird.

Dieser Kurs richtet sich an Besitzer von Junghunden ab dem 4. Monat sowie an erwachsene Hunde, die ihre Grunderziehung festigen oder auffrischen möchten. Im Fokus steht die Festigung der Signale unter steigender Ablenkung und die Förderung der Konzentrationsfähigkeit des Hundes.

Themen wie die Leinenführigkeit, der zuverlässige Rückruf und das Warten in verschiedenen Positionen werden intensiv trainiert. Zudem wird grosser Wert auf die Impulskontrolle gelegt, damit der Hund lernt, auch in aufregenden Momenten ansprechbar zu bleiben.

Die Halter lernen, wie sie ihren Hund souverän durch den Alltag führen und Grenzen fair sowie konsequent setzen. Der Unterricht findet an unterschiedlichen Orten statt, um den Transfer in den realen Alltag zu gewährleisten.

Die Übungen sind so gestaltet, dass sie den natürlichen Bewegungsdrang und die Neugier der jungen Hunde berücksichtigen, ohne sie zu überfordern. Ziel ist ein alltagstauglicher Begleiter, der sich in verschiedensten Situationen ruhig und kontrolliert verhält. Der Kurs bietet zudem Raum, um auf spezifische Themen der Teilnehmenden einzugehen.`,
    objectives: [
      'Festigung der Grundsignale unter Ablenkung im öffentlichen Raum',
      'Verbesserung der Leinenführigkeit in unterschiedlichen Situationen',
      'Aufbau und Sicherung eines zuverlässigen Rückrufs',
      'Training der Impulskontrolle und Frustrationstoleranz',
      'Stärkung der Aufmerksamkeit des Hundes gegenüber dem Halter'
    ],
    prerequisites: 'Abgeschlossener Welpenkurs oder entsprechendes Alter (ab ca. 4 Monaten).',
    keywords: 'Junghunde, Erziehungskurs, Hundeschule, Pubertät Hund, Leinenführigkeit, Rückruf, Gehorsam, Gampelen, Bern, Alltagstraining, Hundetraining, Grunderziehung, Impulskontrolle',
    category_type: 'privat_hobby',
    category_area: 'heim_garten',
    category_specialty: 'Tiere & Hundeschule',
    category_focus: null,
    level: 'all_levels',
    languages: ['Deutsch'],
    price: 35.00,
    session_count: null, // Offene Anzahl Lektionen (Abo-Modell)
    session_length: '60 Min',
    provider_url: 'https://dog-knowhow.ch/kurse/erziehungskurse/',
    delivery_types: ['presence'],
    booking_type: 'lead',
    canton: 'Bern',
    user_id: PROVIDER_USER_ID,
    status: 'draft',
    is_prio: false
  },
  {
    title: 'Mantrailing – Nasenarbeit für Geniesser',
    description: `Mantrailing ist die Personensuche, bei der der Hund seinen hervorragenden Geruchssinn einsetzt, um dem individuellen Geruch eines Menschen zu folgen. Diese Form der Auslastung ist für fast jeden Hund geeignet, unabhängig von Alter, Rasse oder körperlicher Konstitution.

Im Training lernt der Hund, die Spur einer Versteckperson über verschiedene Untergründe wie Asphalt, Wiese oder durch bebautes Gebiet zu verfolgen. Für den Hund bedeutet dies eine hochgradig konzentrierte Arbeit, die ihn mental fordert und auf natürliche Weise auslastet.

Der Halter lernt währenddessen, die feine Körpersprache seines Hundes beim Trailen zu lesen und zu verstehen, wann der Hund sicher auf der Spur ist oder wo Schwierigkeiten auftreten. Das gemeinsame Ziel schweisst das Mensch-Hund-Team eng zusammen und fördert das gegenseitige Vertrauen.

Da immer nur ein Hund arbeitet, eignet sich Mantrailing auch hervorragend für Hunde, die im Kontakt mit Artgenossen eher unsicher oder reaktiv sind. Die Suche endet immer mit einem Erfolgserlebnis und einer hochwertigen Belohnung für den Hund, was das Selbstbewusstsein stärkt.

Die Trainings finden an wechselnden Standorten statt, um die Schwierigkeit stetig anzupassen und die Motivation hochzuhalten.`,
    objectives: [
      'Einführung in die Grundlagen der Personensuche und Geruchsdifferenzierung',
      'Lesen lernen der hündischen Körpersprache während der Sucharbeit',
      'Förderung der mentalen Auslastung und Konzentrationsfähigkeit',
      'Aufbau von Ausdauer und Zielstrebigkeit bei der Nasenarbeit',
      'Stärkung der Bindung durch gemeinsame Erfolgserlebnisse'
    ],
    prerequisites: 'Hund muss im Auto warten können (da einzeln gearbeitet wird). Keine weiteren Vorkenntnisse nötig.',
    keywords: 'Mantrailing, Nasenarbeit, Personensuche, Hundesport, Auslastung, Suchhunde, Geruchssinn, Teamarbeit, Gampelen, Bern, Hobby Hund, Konzentrationstraining, Mentale Auslastung',
    category_type: 'privat_hobby',
    category_area: 'heim_garten',
    category_specialty: 'Tiere & Hundeschule',
    category_focus: null,
    level: 'all_levels',
    languages: ['Deutsch'],
    price: 40.00,
    session_count: null, // Offene Anzahl Trainings
    session_length: '90-120 Min',
    provider_url: 'https://dog-knowhow.ch/kurse/mantrailing/',
    delivery_types: ['presence'],
    booking_type: 'lead',
    canton: 'Bern',
    user_id: PROVIDER_USER_ID,
    status: 'draft',
    is_prio: false
  },
  {
    title: 'Lernspaziergänge & Social Walks',
    description: `Lernspaziergänge bieten die ideale Möglichkeit, Erziehungsthemen direkt in der Realität anzuwenden. Anders als auf dem Trainingsplatz begegnet man hier Joggern, Radfahrern oder anderen Hunden in einer natürlichen Umgebung.

Ziel des Kurses ist es, dass der Hund lernt, trotz dieser Reize ruhig zu bleiben und sich an seinem Halter zu orientieren. Die Spaziergänge werden gezielt genutzt, um die Leinenführigkeit unter echter Ablenkung zu trainieren und Begegnungen mit fremden Hunden kontrolliert zu gestalten.

Ein zentraler Punkt ist die Distanzarbeit: Halter lernen, wie viel Abstand ihr Hund benötigt, um noch ansprechbar zu sein, und wie sie diesen Abstand schrittweise verringern können.

Social Walks hingegen legen den Fokus primär auf das entspannte Miteinanderlaufen im Beisein anderer Hunde, ohne direkten Kontakt. Dies hilft besonders Hunden, die bei Sichtung von Artgenossen schnell in Aufregung geraten. Durch das gemeinsame Gehen in einer Gruppe wird die Akzeptanz gegenüber anderen Hunden gesteigert, ohne dass eine Interaktion erzwungen wird.

Die Teilnehmenden erhalten wertvolle Tipps zur vorausschauenden Führung und zum Stressmanagement beim Hund. Diese Kurseinheiten sind eine essenzielle Ergänzung zum klassischen Gehorsamstraining.`,
    objectives: [
      'Sicheres Führen des Hundes in Alltagssituationen und Begegnungen',
      'Verbesserung der Orientierung am Halter bei Aussenreizen',
      'Erlernen von Strategien für entspannte Hundebegegnungen',
      'Einschätzung der individuellen Distanz des eigenen Hundes',
      'Förderung der Gelassenheit des Hundes im öffentlichen Raum'
    ],
    prerequisites: 'Hunde sollten die Grundsignale kennen; für reaktive Hunde nach Absprache geeignet.',
    keywords: 'Social Walk, Lernspaziergang, Hundebegegnung, Alltagstraining, Leinenaggression, Distanztraining, Hundeschule, Bern, Gampelen, Sozialtraining, Hundetraining, Gassigehen, Reaktivität',
    category_type: 'privat_hobby',
    category_area: 'heim_garten',
    category_specialty: 'Tiere & Hundeschule',
    category_focus: null,
    level: 'all_levels',
    languages: ['Deutsch'],
    price: 35.00,
    session_count: null, // Offene Anzahl Lektionen
    session_length: '60 Min',
    provider_url: 'https://dog-knowhow.ch/kurse/lernspaziergaenge-social-walks/',
    delivery_types: ['presence'],
    booking_type: 'lead',
    canton: 'Bern',
    user_id: PROVIDER_USER_ID,
    status: 'draft',
    is_prio: false
  }
];

async function insertCourses() {
  console.log('Inserting 4 Dog Know-how courses...\n');

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

  console.log('\n---');
  console.log('Done! All courses are in "draft" status.');
  console.log('\nTo publish all courses, run in Supabase SQL Editor:');
  console.log(`UPDATE courses SET status = 'published' WHERE user_id = '${PROVIDER_USER_ID}' AND status = 'draft';`);
}

insertCourses();
