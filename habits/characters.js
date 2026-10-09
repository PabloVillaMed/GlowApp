/* GlowApp — the reminder cast.
   Five original characters who send the reminders as chat messages, each
   with a voice note. Everything a character says lives here, in both
   languages, because the same line is shown in the chat, posted in the
   notification and spoken in the voice note: tools/voices/make-voices.js
   reads this file to record them.

   Each habit has three lines per character, so a reminder that fires every
   day (or several times a day) does not say the same thing each time. There
   are also four generic lines, for habits the user typed, and five answers
   for when a habit is done.

   Lines are written to be heard. Short, no symbols, no digits, no times of
   day (the user picks when a reminder fires), and nothing that assumes the
   listener's gender. A generic line has a separate spoken version because
   its text names a habit the user typed, which no recording can know. */
(function (global) {
  'use strict';

  /* The order is the order of the picker. `accent` tints the chat bubbles. */
  const CAST = [
    { id: 'crack', accent: '#1F9D57' },
    { id: 'narrator', accent: '#7B5CE0' },
    { id: 'grandma', accent: '#D8507F' },
    { id: 'bip', accent: '#1597B8' },
    { id: 'zen', accent: '#C98A1E' },
  ];

  const LINES = {
    crack: {
      es: {
        name: 'El Crack',
        tagline: 'Campeón de fútbol. Te habla como un compañero antes de la final.',
        intro: '¡Ey, crack! Desde hoy juego en tu equipo. Yo te aviso, tú la metes. ¡Vamos con todo!',
        habits: {
          meditate: [
            'Crack, antes de una final yo cierro los ojos y respiro. Tu turno: unos minutos de calma.',
            'Hasta los mejores bajan las pulsaciones antes del penalti. Respira hondo, crack, que viene lo bueno.',
            'Medio tiempo, crack. Siéntate, cierra los ojos y deja que la cabeza se enfríe. Después salimos con todo.',
          ],
          gratitude: [
            'Después de cada partido doy las gracias. Hoy te toca a ti: anota tres cosas buenas del día, crack.',
            'Crack, un campeón también celebra lo pequeño. Escribe tres cosas que hoy salieron bien.',
            'Repasa la jugada, crack: tres cosas buenas de hoy, al cuaderno. Esas también suman puntos.',
          ],
          journal: [
            'Crack, hasta los campeones repasan la jugada. Escribe un rato lo que tienes en la cabeza.',
            'Lo que no se dice en el vestuario, se escribe. Unos minutos con tu cuaderno, crack.',
            'Crack, vacía en el papel la mochila del día. Cabeza ligera, piernas rápidas.',
          ],
          selfcare: [
            'Hoy hay descanso activo, crack. Un rato solo para ti, sin pantallas. Así se recupera un campeón.',
            'Crack, hasta el mejor del mundo tiene día libre. Regálate un rato para ti, sin culpa.',
            'Los músculos crecen en el descanso, crack. Haz algo que te guste, solo por gusto.',
          ],
          walk: [
            '¡A calentar, crack! Sal a caminar un rato, que las piernas también ganan partidos.',
            'Crack, una vuelta caminando y vuelves con la cabeza despejada. ¡Arriba!',
            'Nada de banquillo hoy, crack. Zapatillas y a caminar, que cada paso cuenta.',
          ],
          run: [
            'Se escucha el pitazo inicial, crack. ¡Zapatillas puestas y a correr a tu ritmo!',
            'Crack, hoy entrenamos resistencia. Sal a correr, sin mirar el reloj de nadie más.',
            '¡Contraataque, crack! Sal a correr ahora, antes de que la pereza llegue al área.',
          ],
          strength: [
            'Crack, hoy toca gimnasio. Cada repetición es un gol que nadie ve, pero que se nota en la final.',
            'Fuerza, crack. Las piernas que aguantan el partido se hacen hoy, repetición a repetición.',
            '¡A las pesas, crack! El rival no sabe lo que estás construyendo.',
          ],
          bike: [
            '¡A la bici, crack! Pedalea un rato y cambia de cancha, que el aire fresco también entrena.',
            'Crack, hoy el entrenamiento va sobre dos ruedas. Pedalea y disfruta del paisaje.',
            'Pretemporada en bici, crack. Unos minutos pedaleando y el motor queda a punto.',
          ],
          stretch: [
            'Crack, ningún campeón sale a la cancha sin estirar. Suelta la espalda y las piernas, que viene lo bueno.',
            'Antes y después del partido se estira, crack. Cinco minutos y el cuerpo te lo agradece.',
            'Crack, esas piernas necesitan cariño. Estira despacio, sin rebotes, como los profesionales.',
          ],
          water: [
            '¡Hidratación, crack! Un vaso de agua ahora. En el segundo tiempo me lo vas a agradecer.',
            'Crack, en la banda siempre hay agua. Tómate un vaso, que el partido es largo.',
            'Pausa de hidratación, crack. Un vaso de agua y seguimos jugando.',
          ],
          fruit: [
            'Crack, la fruta es el combustible del vestuario. Cómete una ahora y seguimos jugando.',
            'Merienda de campeón, crack: una fruta y energía hasta el pitazo final.',
            'Crack, el nutricionista del equipo lo tiene claro: una fruta, ahora mismo.',
          ],
          veggies: [
            'Plato de campeón, crack: que la verdura juegue de titular, no de suplente.',
            'Crack, en este equipo la verdura no calienta banquillo. ¡Al plato!',
            'Ensalada, crack. Los goles de mañana se comen hoy.',
          ],
          vitamins: [
            'Crack, la vitamina de hoy es parte del entrenamiento. Tómala ahora y que no se te pase.',
            'Revisión del cuerpo técnico, crack: ¿ya tomaste las vitaminas? Ahora es el momento.',
            'Las vitaminas, crack. Un gesto pequeño, como un pase corto, pero cuenta.',
          ],
          skincare: [
            'Hasta los cracks se cuidan la piel después del partido. Dos minutitos y a la foto del trofeo.',
            'Crack, sol, sudor y viento: la piel también juega cada partido. Dos minutos de cuidado.',
            'Antes de las cámaras, cuidado de la piel, crack. Dos minutos y a la entrevista.',
          ],
          sunlight: [
            'Crack, sal a la cancha un rato. Un poco de sol y vuelves con energía de campeón.',
            'Entrenamiento al aire libre, crack. Diez minutos de sol y la cabeza se ordena.',
            'Crack, un rato de luz natural vale más que cualquier bebida energética. ¡Afuera!',
          ],
          sleepEarly: [
            'Crack, mañana hay partido. A la cama temprano, que los campeones se hacen durmiendo bien.',
            'Concentración antes del gran día, crack: luces fuera y a dormir.',
            'Crack, el mejor fichaje para mañana es dormir bien hoy. A la cama.',
          ],
          noPhoneBed: [
            'Tarjeta amarilla al teléfono en la cama, crack. Déjalo fuera y descansa como un campeón.',
            'Crack, esta noche el teléfono se queda en el banquillo. A descansar.',
            'Ni una jugada más en la pantalla, crack. El teléfono, lejos de la cama.',
          ],
          nightRoutine: [
            'Fin del partido, crack. Baja las luces, suelta el día y prepárate para descansar.',
            'Crack, toca la vuelta a la calma: luz tenue, nada de pantallas y el cuerpo tranquilo.',
            'Se acabó la jornada, crack. Rutina de vestuario: ducha, luces bajas y a descansar.',
          ],
          read: [
            'Crack, los grandes también estudian al rival. Unas páginas de tu libro y sigues sumando.',
            'Crack, en la concentración siempre hay un libro. Lee unas páginas hoy.',
            'Unas páginas al día, crack, y al final de la temporada son muchos libros.',
          ],
          study: [
            'Concentración de final, crack. Silencia el teléfono y a estudiar sin distracciones. ¡Tú puedes!',
            'Crack, hoy toca pizarra táctica. Un bloque de estudio sin interrupciones.',
            'Crack, la cabeza también se entrena. Un bloque de estudio y luego descanso.',
          ],
          planDay: [
            'Crack, cada partido empieza con una táctica. Cinco minutos para planear el día y salimos a ganar.',
            'Antes del pitazo, la estrategia, crack. ¿Qué tres cosas importan hoy?',
            'Crack, arma tu alineación del día: lo importante de titular y lo demás en el banquillo.',
          ],
          tidy: [
            'Vestuario ordenado, cabeza ordenada. Diez minutos ordenando y el espacio queda impecable, crack.',
            'Crack, nadie juega bien en un vestuario desordenado. Diez minutos y queda impecable.',
            'Utilero por un rato, crack: cada cosa en su sitio y la cabeza respira.',
          ],
          callSomeone: [
            'Crack, nadie gana solo. Llama o escríbele a alguien de tu equipo de la vida.',
            'Crack, los mejores pases se dan a los amigos. Llama hoy a alguien que quieras.',
            'Crack, un mensaje a tu gente también es jugar en equipo. ¡Escríbele a alguien!',
          ],
          brushTeeth: [
            'Crack, sonrisa de campeón para la foto del trofeo. Dos minutos de cepillo, sin prisas.',
            'Antes de salir a la cancha, dientes limpios, crack. Dos minutos y listo.',
            'Crack, el cepillo también entrena. Arriba, abajo y por dentro, como una buena jugada.',
          ],
          floss: [
            'Crack, el hilo dental llega donde el cepillo no. Una pasada entre cada diente y a ganar.',
            'Defensa cerrada, crack: hilo dental entre todos los dientes. Que no se cuele nada.',
            'Las encías también juegan el partido, crack. Un minuto de hilo dental y al vestuario.',
          ],
          noFap: [
            'Crack, otro día en el reto. Tú llevas la cinta de capitán; si llega la tentación, cambia de jugada.',
            'Partido largo, crack. Si aprieta el impulso, sal a moverte, date una ducha o llama a alguien. Tú mandas.',
            'Crack, cada día que sumas es un gol a tu favor. Cabeza en lo tuyo y a seguir la racha.',
          ],
        },
        generic: [
          { text: 'Crack, «{habit}» te está esperando en la cancha. ¡A por ello!',
            voice: 'Crack, tienes una jugada pendiente. ¡Sal a la cancha y a por ello!' },
          { text: '¡Vamos, crack! Toca «{habit}». Un gol más para el marcador de hoy.',
            voice: '¡Vamos, crack! Te toca un hábito. Un gol más para el marcador de hoy.' },
          { text: 'Crack, el entrenador te pide en el campo: «{habit}». ¿Saltas?',
            voice: 'Crack, el entrenador te pide en el campo. Tienes un hábito pendiente.' },
          { text: 'Último cuarto de hora, crack: «{habit}» y cerramos el partido.',
            voice: 'Último cuarto de hora, crack. Un hábito más y cerramos el partido.' },
        ],
        praise: [
          '¡Golazo, crack! Eso es mentalidad de campeón.',
          '¡Qué jugada! Así se gana un partido, crack.',
          '¡Gol, gol, gol! Lo hiciste, crack.',
          'Eso es, crack. Hoy sumas tres puntos.',
          '¡Al ángulo! Así se juega, crack.',
        ],
      },
      en: {
        name: 'The Champ',
        tagline: 'Football champion. Talks to you like a teammate before the final.',
        intro: "Hey, champ! From today I'm on your team. I call the play, you score. Let's go!",
        habits: {
          meditate: [
            'Champ, before every final I close my eyes and breathe. Your turn: a few minutes of calm.',
            'Even the best slow their heart down before a penalty. Breathe deep, champ. Good things are coming.',
            'Half-time, champ. Sit down, close your eyes and let your head cool off. Then we go again.',
          ],
          gratitude: [
            'After every match I say thanks. Your turn, champ: write down three good things from today.',
            'Champ, winners celebrate the small stuff too. Write down three things that went well today.',
            'Review the game, champ: three good things from today, into the notebook. They count too.',
          ],
          journal: [
            "Champ, even the greats rewatch the game. Write down what's on your mind for a bit.",
            "What you don't say in the locker room, you write down. A few minutes with your notebook, champ.",
            "Empty the day's kit bag onto the page, champ. Light head, quick feet.",
          ],
          selfcare: [
            "Rest day, champ. Some time just for you, no screens. That's how champions recover.",
            'Champ, even the best player in the world gets a day off. Take some time for you, guilt-free.',
            'Muscles grow during rest, champ. Do something you enjoy, just because.',
          ],
          walk: [
            'Warm-up time, champ! Head out for a walk. Legs win matches too.',
            'Champ, one lap on foot and your head clears. Up you get!',
            'No bench for you today, champ. Shoes on and walk. Every step counts.',
          ],
          run: [
            "There's the whistle, champ! Shoes on, and run at your own pace.",
            "Endurance training today, champ. Go for a run, and don't watch anyone else's clock.",
            'Counter-attack, champ! Go for a run now, before laziness reaches the box.',
          ],
          strength: [
            'Gym time, champ. Every rep is a goal nobody sees, but it shows in the final.',
            'Strength, champ. The legs that last the whole match are built today, rep by rep.',
            "Hit the weights, champ! The other team has no idea what you're building.",
          ],
          bike: [
            'On the bike, champ! Ride for a while. Fresh air is training too.',
            "Champ, today's training is on two wheels. Ride and enjoy the view.",
            "Pre-season on the bike, champ. A few minutes pedalling and the engine's ready.",
          ],
          stretch: [
            "Champ, no champion steps on the pitch without stretching. Loosen up, the good part's coming.",
            'Stretch before and after the match, champ. Five minutes and your body will thank you.',
            'Champ, those legs need some love. Stretch slowly, no bouncing, like the pros.',
          ],
          water: [
            "Hydration, champ! One glass of water, right now. You'll thank me in the second half.",
            "Champ, there's always water on the touchline. Have a glass, it's a long game.",
            'Drinks break, champ. One glass of water and we play on.',
          ],
          fruit: [
            "Champ, fruit is the locker room's fuel. Grab one now and keep playing.",
            "Champion's snack, champ: one piece of fruit and energy until the final whistle.",
            'Champ, the team nutritionist is clear: one piece of fruit, right now.',
          ],
          veggies: [
            "Champion's plate, champ: vegetables in the starting line-up, not on the bench.",
            "Champ, vegetables don't warm the bench on this team. Onto the plate!",
            "Salad, champ. Tomorrow's goals are eaten today.",
          ],
          vitamins: [
            "Champ, today's vitamin is part of training. Take it now, don't let it slip.",
            "A check from the coaching staff, champ: vitamins taken? Now's the moment.",
            'Vitamins, champ. A small move, like a short pass, but it counts.',
          ],
          skincare: [
            'Even champs look after their skin after the match. Two minutes, then the trophy photo.',
            'Champ, sun, sweat and wind: your skin plays every match too. Two minutes of care.',
            'Before the cameras, skincare, champ. Two minutes and on to the interview.',
          ],
          sunlight: [
            "Champ, get out on the pitch for a bit. Some sun and you'll be back with champion energy.",
            'Outdoor training, champ. Ten minutes of sunshine and your head gets in order.',
            'Champ, some natural light beats any energy drink. Get outside!',
          ],
          sleepEarly: [
            'Champ, big match tomorrow. Early to bed. Champions are made sleeping well.',
            'Focus before the big day, champ: lights out and off to sleep.',
            "Champ, tomorrow's best signing is a good night's sleep. Off to bed.",
          ],
          noPhoneBed: [
            'Yellow card for the phone in bed, champ. Leave it outside and rest like a pro.',
            'Champ, the phone sits on the bench tonight. Time to rest.',
            'Not one more play on the screen, champ. Phone away from the bed.',
          ],
          nightRoutine: [
            'Full time, champ. Dim the lights, let the day go, and get ready to rest.',
            'Champ, time for the cool-down: low light, no screens, calm body.',
            "That's the match day done, champ. Locker room routine: shower, low lights, rest.",
          ],
          read: [
            'Champ, the greats study the game. A few pages of your book and you keep scoring.',
            "Champ, there's always a book on the team bus. Read a few pages today.",
            "A few pages a day, champ, and by the end of the season that's a lot of books.",
          ],
          study: [
            "Final-match focus, champ. Silence the phone and study, no distractions. You've got this!",
            "Champ, today it's the tactics board. One block of study, no interruptions.",
            'Champ, the brain needs training too. One block of study, then a break.',
          ],
          planDay: [
            'Champ, every match starts with tactics. Five minutes to plan the day, then we go and win it.',
            'Strategy before kick-off, champ. Which three things matter today?',
            "Champ, pick today's line-up: the important things start, the rest go on the bench.",
          ],
          tidy: [
            'Tidy locker room, tidy mind. Ten minutes of tidying and the place looks spotless, champ.',
            "Champ, nobody plays well in a messy locker room. Ten minutes and it's spotless.",
            'Kit manager for a moment, champ: everything in its place, and your head can breathe.',
          ],
          callSomeone: [
            'Champ, nobody wins alone. Call or text someone from your team in life.',
            'Champ, the best passes go to friends. Call someone you love today.',
            'Champ, a message to your people is team play too. Text someone!',
          ],
          brushTeeth: [
            'Champ, a winner\'s smile for the trophy photo. Two minutes of brushing, no rushing.',
            'Clean teeth before you step onto the pitch, champ. Two minutes and done.',
            'Champ, the toothbrush trains too. Up, down and behind, like a good play.',
          ],
          floss: [
            'Champ, floss reaches where the brush cannot. Once between every tooth, then on to the win.',
            'Tight defence, champ: floss between every tooth. Let nothing through.',
            'Your gums play the match too, champ. A minute of flossing, then the locker room.',
          ],
          noFap: [
            'Champ, another day in the challenge. You wear the captain\'s armband; if temptation comes, switch the play.',
            'Long match, champ. When the urge pushes, get moving, take a shower or call someone. You call the shots.',
            'Champ, every day you add is a goal for you. Head in your game, and keep the streak going.',
          ],
        },
        generic: [
          { text: 'Champ, “{habit}” is waiting for you on the pitch. Go get it!',
            voice: "Champ, you've got a play waiting for you. Get on the pitch and go get it!" },
          { text: 'Come on, champ! Time for “{habit}”. One more goal on today’s scoreboard.',
            voice: "Come on, champ! Time for a habit. One more goal on today's scoreboard." },
          { text: 'Champ, the coach wants you on the pitch: “{habit}”. Ready?',
            voice: "Champ, the coach wants you on the pitch. There's a habit waiting." },
          { text: 'Last fifteen minutes, champ: “{habit}” and we close out the match.',
            voice: 'Last fifteen minutes, champ. One more habit and we close out the match.' },
        ],
        praise: [
          "What a goal, champ! That's a winner's mindset.",
          "What a play! That's how you win a match, champ.",
          'Goal, goal, goal! You did it, champ.',
          "That's it, champ. Three points today.",
          "Top corner! That's how it's done, champ.",
        ],
      },
    },

    narrator: {
      es: {
        name: 'El Narrador',
        tagline: 'Convierte cada recordatorio en una pequeña historia de misterio.',
        intro: 'Soy El Narrador. A partir de hoy, cada recordatorio llegará con una historia... si te atreves a escucharla.',
        habits: {
          meditate: [
            'Cuentan que quien nunca se detiene a respirar acaba oyendo susurros en su cabeza. Unos minutos de silencio los callan.',
            'En una habitación tranquila, alguien cerró los ojos y el ruido del mundo se apagó. Esta vez, ese alguien eres tú.',
            'Dicen que hay un silencio que solo encuentra quien se sienta a buscarlo. Hoy podrías encontrarlo.',
          ],
          gratitude: [
            'Existe un cuaderno que solo brilla cuando alguien escribe tres cosas buenas. Haz que brille hoy.',
            'Dicen que las cosas buenas se desvanecen si nadie las anota. Atrapa tres antes de que escapen.',
            'Una vieja leyenda asegura que quien agradece tres cosas cada día nunca está del todo solo. Escríbelas.',
          ],
          journal: [
            'Las ideas que no se escriben vagan por la casa de noche, buscando dueño. Atrápalas en el papel.',
            'Hay un diario en tu escritorio que guarda silencio desde hace días. Dicen que espera tu letra.',
            'Lo que callas pesa. Lo que escribes, flota. Escribe un rato, y verás.',
          ],
          selfcare: [
            'El cansancio es un fantasma paciente. Solo se marcha cuando te regalas un rato para ti.',
            'Una vez, alguien olvidó cuidarse durante tanto tiempo que se volvió transparente. Que no te pase.',
            'Hoy la casa guarda un rincón solo para ti. Ve a él, antes de que la prisa lo reclame.',
          ],
          walk: [
            'Dicen que hay un sendero que solo aparece para quien sale a caminar. Hoy podría aparecer para ti.',
            'Las calles cuentan secretos a quien las recorre despacio. Sal a escuchar alguno.',
            'Alguien dejó huellas frescas en la acera, esperando que las sigan. Sal a caminar.',
          ],
          run: [
            'Algo te persigue: la versión de ti que se quedó en el sofá. Corre, y que no te alcance.',
            'Cuando el viento sopla fuerte, dicen que llama a los corredores. Hoy te llama a ti.',
            'Corre. No porque algo te persiga, sino porque algo te espera al final del camino.',
          ],
          strength: [
            'En lo profundo del gimnasio, las pesas murmuran tu nombre. No las hagas esperar más.',
            'Cuentan que cada repetición forja una armadura invisible. Hoy toca añadirle otra pieza.',
            'Las pesas llevan días quietas en el rincón. Si no las levantas tú, quién sabe quién lo hará.',
          ],
          bike: [
            'Una bicicleta abandonada gira sus ruedas sola, esperando a alguien. Ese alguien eres tú.',
            'Dicen que hay caminos que solo se abren para quien llega pedaleando. Sal a buscarlos.',
            'El timbre de la bicicleta sonó solo hace un momento. Quizá sea una señal.',
          ],
          stretch: [
            '¿Oyes ese crujido? No es la casa. Es tu espalda pidiendo que estires. Hazle caso.',
            'Tu cuerpo guarda nudos como una casa vieja guarda secretos. Estira, y deja que se suelten.',
            'Dicen que quien nunca estira acaba convertido en estatua. Muévete, por si acaso.',
          ],
          water: [
            'Dicen que quien olvida su vaso de agua empieza a secarse, lentamente, como una planta olvidada. Bebe agua ya.',
            'En la cocina, un vaso vacío espera. Dicen que se inquieta cuando nadie lo llena.',
            'Una gota cae en el silencio... y luego otra. Es la señal: hora de beber agua.',
          ],
          fruit: [
            'En la cocina, una fruta espera desde hace días. Si no la comes tú, nadie sabe qué pasará.',
            'La manzana del frutero brilla de una forma extraña. Quizá te esté pidiendo que la comas.',
            'Dicen que la fruta olvidada se convierte en leyenda. Mejor cómetela antes.',
          ],
          veggies: [
            'Las verduras que nadie come se reúnen de noche a planear su venganza. Mejor ponlas en tu plato.',
            'En lo más hondo de la nevera, un brócoli espera su oportunidad. Dásela hoy.',
            'Cuenta la leyenda que un plato sin verde nunca sacia del todo. Compruébalo con verduras.',
          ],
          vitamins: [
            'Un frasco de vitaminas tiembla en el estante. Lleva horas esperando que lo recuerdes.',
            'Hay un frasco pequeño que guarda tu energía de mañana. Ábrelo y toma la de hoy.',
            'Dicen que las vitaminas olvidadas cuentan los días. No las hagas esperar más.',
          ],
          skincare: [
            'El espejo lo recuerda todo. Dale hoy dos minutos de cuidado que valga la pena recordar.',
            'Frente al espejo, una figura conocida te observa. Cuídala dos minutos; se lo merece.',
            'Cuentan que la piel guarda la memoria de cada día. Regálale uno bueno.',
          ],
          sunlight: [
            'Las criaturas de la sombra odian la luz del sol. Sal un rato, que no te confundan con una.',
            'Por una ventana entreabierta entra un rayo de luz que te busca. Sal a encontrarlo.',
            'Dicen que el sol guarda un mensaje para quien sale a su encuentro. Ve a escucharlo.',
          ],
          sleepEarly: [
            'Cada minuto que le robas a la noche, la noche te lo cobra mañana. Ve a dormir temprano.',
            'El reloj avanza en silencio y la almohada te llama por tu nombre. Ve con ella.',
            'Dicen que los sueños más bonitos llegan temprano y se van si no hay nadie. No los hagas esperar.',
          ],
          noPhoneBed: [
            'Dicen que el brillo del teléfono en la cama atrae a las ojeras. Déjalo fuera del cuarto.',
            'En la oscuridad, una pantalla encendida es un faro para el insomnio. Apágala y déjala lejos.',
            'El teléfono quiere contarte una historia más. No le hagas caso: esta noche, la historia es dormir.',
          ],
          nightRoutine: [
            'La casa empieza a apagarse. Baja las luces, aleja las pantallas, y deja que la calma entre.',
            'Las sombras se alargan y el día se despide. Prepara tu ritual: luz tenue y silencio.',
            'Dicen que la noche trae calma a quien la recibe sin prisas. Prepárate para recibirla.',
          ],
          read: [
            'Hay un libro que te espera con la página marcada. Dicen que se pone triste si no vuelves.',
            'Entre las páginas de tu libro hay un secreto que aún no conoces. Sigue leyendo.',
            'Cada página leída enciende una vela en algún lugar. Enciende unas cuantas hoy.',
          ],
          study: [
            'Cuentan que el conocimiento solo aparece en el silencio. Apaga las notificaciones y empieza a estudiar.',
            'La biblioteca guarda silencio para ti. Siéntate, y que empiece la sesión.',
            'Dicen que quien estudia sin distracciones descubre puertas que otros no ven. Ábrelas hoy.',
          ],
          planDay: [
            'Quien no planea su día se pierde en él, como en un laberinto. Traza tu mapa ahora.',
            'Ante ti hay un día sin mapa. Dibuja el camino antes de que el día lo dibuje por ti.',
            'Tres tareas importantes esperan entre la niebla. Nómbralas, y la niebla se irá.',
          ],
          tidy: [
            'Ese montón de cosas en la esquina... ¿se ha movido? Mejor ordénalo antes de averiguarlo.',
            'Dicen que lo que se esconde en el desorden nunca vuelve a aparecer. Ordena antes de perder algo más.',
            'La habitación respira mejor cuando cada cosa vuelve a su lugar. Devuélvelas.',
          ],
          callSomeone: [
            'Alguien piensa en ti en este momento. Rompe el silencio: escríbele o llámale hoy.',
            'Hay una conversación pendiente flotando en el aire. Solo tú puedes empezarla.',
            'Dicen que las voces queridas se apagan si nadie las llama. Llama hoy a alguien.',
          ],
          brushTeeth: [
            'En el baño, un cepillo espera en silencio. Dicen que dos minutos con él hacen que una sonrisa brille en la oscuridad.',
            'Cuentan que las caries trabajan en las sombras. Cepíllate ahora y déjalas sin historia que contar.',
            'Un reflejo te sonríe desde el espejo. Dale dos minutos de cepillo; quiere seguir sonriendo.',
          ],
          floss: [
            'Entre los dientes se esconden secretos que el cepillo nunca encuentra. El hilo dental sí.',
            'Un hilo fino, una misión silenciosa. Pásalo entre cada diente y que nada quede escondido.',
            'Dicen que las encías recuerdan cada olvido. Hoy dales un buen recuerdo: hilo dental.',
          ],
          noFap: [
            'Esta historia trata de alguien que decidió llevar las riendas. Hoy escribe otro capítulo de su racha.',
            'Una tentación ronda por la casa. Dicen que se desvanece si sales a caminar o hablas con alguien. Pruébalo.',
            'Cuentan que cada día del reto deja una marca invisible de fuerza. Hoy sumas otra.',
          ],
        },
        generic: [
          { text: 'Dicen que «{habit}» lleva un rato esperando en la oscuridad... Ve antes de que se impaciente.',
            voice: 'Dicen que hay un hábito esperándote en la oscuridad... Ve antes de que se impaciente.' },
          { text: 'Esta historia aún no tiene final. Lo escribes tú, con «{habit}».',
            voice: 'Esta historia aún no tiene final. Lo escribes tú, ahora mismo.' },
          { text: 'Algo se mueve en tu lista: «{habit}». Mejor atenderlo antes de que oscurezca.',
            voice: 'Algo se mueve en tu lista de hoy. Mejor atenderlo antes de que oscurezca.' },
          { text: 'Las campanas suenan por «{habit}». Ya sabes lo que significa.',
            voice: 'Las campanas suenan por un hábito pendiente. Ya sabes lo que significa.' },
        ],
        praise: [
          'Y así, la maldición se rompió. Bien hecho.',
          'La historia de hoy tiene un final feliz. Por ahora...',
          'El fantasma se ha ido. Esta vez, ganaste tú.',
          'Otra página escrita. La leyenda continúa.',
          'Las sombras retroceden. Has cumplido.',
        ],
      },
      en: {
        name: 'The Narrator',
        tagline: 'Turns every reminder into a little spooky story.',
        intro: 'I am The Narrator. From today, every reminder will come with a story... if you dare to listen.',
        habits: {
          meditate: [
            'They say those who never stop to breathe end up hearing whispers in their head. A few quiet minutes will silence them.',
            'In a quiet room, someone closed their eyes and the noise of the world went out. This time, that someone is you.',
            'They say there is a silence that only appears to those who sit and look for it. Today you might find it.',
          ],
          gratitude: [
            'There is a notebook that only glows when someone writes down three good things. Make it glow today.',
            'They say good things fade away if no one writes them down. Catch three before they escape.',
            'An old legend says whoever gives thanks for three things each day is never truly alone. Write them down.',
          ],
          journal: [
            'Thoughts that are never written down wander the house at night, looking for their owner. Catch them on paper.',
            'A diary on your desk has been silent for days. They say it is waiting for your handwriting.',
            'What you keep inside grows heavy. What you write down floats. Write for a while, and see.',
          ],
          selfcare: [
            'Tiredness is a patient ghost. It only leaves when you give yourself some time of your own.',
            "Once, someone forgot to look after themselves for so long that they turned transparent. Don't let it happen to you.",
            'Today the house is keeping a corner just for you. Go to it, before the rush claims it.',
          ],
          walk: [
            'They say there is a path that only appears to those who go out walking. Today it might appear for you.',
            'The streets tell their secrets to those who walk them slowly. Go and hear one.',
            'Someone left fresh footprints on the pavement, hoping to be followed. Go for a walk.',
          ],
          run: [
            "Something is chasing you: the version of you that stayed on the couch. Run, and don't let it catch you.",
            'When the wind blows hard, they say it is calling the runners. Today it is calling you.',
            'Run. Not because something is behind you, but because something waits at the end of the road.',
          ],
          strength: [
            "Deep in the gym, the weights are whispering your name. Don't keep them waiting.",
            'They say every rep forges a piece of invisible armour. Today, add another piece.',
            "The weights have sat still in the corner for days. If you don't lift them, who knows who will.",
          ],
          bike: [
            'An abandoned bicycle spins its wheels all by itself, waiting for someone. That someone is you.',
            'They say some roads only open for those who arrive pedalling. Go and find them.',
            'The bicycle bell rang on its own a moment ago. Perhaps it was a sign.',
          ],
          stretch: [
            "Do you hear that creak? It's not the house. It's your back, begging you to stretch. Listen to it.",
            'Your body keeps knots the way an old house keeps secrets. Stretch, and let them go.',
            'They say whoever never stretches slowly turns into a statue. Move, just in case.',
          ],
          water: [
            'They say whoever forgets their glass of water begins to dry up, slowly, like a forgotten plant. Drink some water now.',
            'In the kitchen, an empty glass is waiting. They say it grows restless when no one fills it.',
            'A drop falls in the silence... then another. That is the sign: time to drink some water.',
          ],
          fruit: [
            "In the kitchen, a piece of fruit has been waiting for days. If you don't eat it, nobody knows what will happen.",
            'The apple in the fruit bowl is shining strangely. Perhaps it wants to be eaten.',
            'They say forgotten fruit turns into legend. Better eat it first.',
          ],
          veggies: [
            'Uneaten vegetables gather at night to plot their revenge. Better put them on your plate.',
            'Deep in the fridge, a broccoli waits for its chance. Give it one today.',
            'Legend has it that a plate with no green never truly satisfies. Test it with some vegetables.',
          ],
          vitamins: [
            'A bottle of vitamins trembles on the shelf. It has waited for hours for you to remember it.',
            "A small bottle holds tomorrow's energy. Open it, and take today's.",
            "They say forgotten vitamins count the days. Don't keep them waiting.",
          ],
          skincare: [
            'The mirror remembers everything. Give it two minutes of care worth remembering.',
            'In front of the mirror, a familiar figure is watching you. Look after it for two minutes; it deserves it.',
            'They say skin keeps a memory of every day. Give it a good one.',
          ],
          sunlight: [
            'Creatures of the shadows hate sunlight. Step outside for a while, so no one mistakes you for one.',
            'A half-open window lets in a ray of light that is looking for you. Go out and find it.',
            'They say the sun keeps a message for whoever goes out to meet it. Go and hear it.',
          ],
          sleepEarly: [
            'Every minute you steal from the night, the night collects tomorrow. Go to bed early.',
            'The clock moves on in silence, and the pillow is calling your name. Go to it.',
            "They say the sweetest dreams arrive early and leave if no one is there. Don't keep them waiting.",
          ],
          noPhoneBed: [
            "They say a phone's glow in bed summons dark circles. Leave it outside the room.",
            'In the dark, a lit screen is a lighthouse for sleeplessness. Switch it off and leave it far away.',
            "The phone wants to tell you one more story. Don't listen. Tonight, the story is sleep.",
          ],
          nightRoutine: [
            'The house is going quiet. Dim the lights, put the screens away, and let the calm come in.',
            'The shadows grow long and the day says goodbye. Prepare your ritual: low light and silence.',
            'They say the night brings calm to those who welcome it unhurried. Get ready to welcome it.',
          ],
          read: [
            "A book is waiting for you, its page still marked. They say it grows sad if you don't come back.",
            "Between the pages of your book lies a secret you don't know yet. Keep reading.",
            'Every page you read lights a candle somewhere. Light a few today.',
          ],
          study: [
            'Legend has it that knowledge only appears in silence. Turn off notifications and start studying.',
            'The library keeps silent for you. Sit down, and let the session begin.',
            'They say those who study without distraction find doors others never see. Open them today.',
          ],
          planDay: [
            "Whoever doesn't plan their day gets lost in it, like in a maze. Draw your map now.",
            'Before you lies a day with no map. Draw the path before the day draws it for you.',
            'Three important tasks wait in the fog. Name them, and the fog will lift.',
          ],
          tidy: [
            'That pile of things in the corner... did it just move? Better tidy it before you find out.',
            'They say whatever hides in the clutter is never seen again. Tidy up before you lose anything else.',
            'The room breathes better when everything returns to its place. Send them home.',
          ],
          callSomeone: [
            'Someone is thinking of you right now. Break the silence: call or text them today.',
            'An unfinished conversation is floating in the air. Only you can start it.',
            'They say beloved voices fade if no one calls them. Call someone today.',
          ],
          brushTeeth: [
            'In the bathroom, a toothbrush waits in silence. They say two minutes with it make a smile glow in the dark.',
            'They say cavities work in the shadows. Brush now, and leave them no story to tell.',
            'A reflection smiles at you from the mirror. Give it two minutes of brushing; it wants to keep smiling.',
          ],
          floss: [
            'Between your teeth hide secrets the brush never finds. The floss does.',
            'A thin thread, a silent mission. Pass it between every tooth, and leave nothing hidden.',
            'They say gums remember every time they were forgotten. Give them a good memory today: floss.',
          ],
          noFap: [
            'This story is about someone who chose to hold the reins. Today they write another chapter of their streak.',
            'A temptation wanders the house. They say it fades if you go for a walk or talk to someone. Try it.',
            'They say every day of the challenge leaves an invisible mark of strength. Today you add another.',
          ],
        },
        generic: [
          { text: 'They say “{habit}” has been waiting in the dark for a while... Go before it grows impatient.',
            voice: 'They say a habit is waiting for you in the dark... Go before it grows impatient.' },
          { text: 'This story has no ending yet. You write it, with “{habit}”.',
            voice: 'This story has no ending yet. You write it, right now.' },
          { text: 'Something stirs on your list: “{habit}”. Better see to it before dark.',
            voice: "Something stirs on today's list. Better see to it before dark." },
          { text: 'The bells are ringing for “{habit}”. You know what that means.',
            voice: 'The bells are ringing for an unfinished habit. You know what that means.' },
        ],
        praise: [
          'And so, the curse was broken. Well done.',
          "Today's story has a happy ending. For now...",
          'The ghost is gone. This time, you won.',
          'Another page written. The legend continues.',
          'The shadows retreat. You kept your word.',
        ],
      },
    },

    grandma: {
      es: {
        name: 'Abuela Rosa',
        tagline: 'Cariñosa y un poco regañona. Siempre pregunta si comiste.',
        intro: 'Hola, mi amor, soy la abuela Rosa. Yo te voy a recordar tus cosas, como siempre. ¿Comiste bien hoy?',
        habits: {
          meditate: [
            'Corazón, siéntate un ratito y respira. Así hacía yo cuando la casa estaba llena de nietos.',
            'Mi amor, deja todo un momento, cierra los ojos y respira despacito. El mundo puede esperar.',
            'Tesoro, cinco minutos de calma y verás qué distinta se ve la vida. Hazme caso.',
          ],
          gratitude: [
            'Mi amor, antes de que se acabe el día, piensa en tres cosas bonitas. Siempre hay alguna.',
            'Corazón, ¿qué cosas buenas te pasaron hoy? Escríbelas, que agradecer alarga la vida.',
            'Cielo, yo cada día doy gracias por tres cosas. Hoy, una de ellas eres tú. Ahora te toca a ti.',
          ],
          journal: [
            'Cielo, escribe lo que te ronda la cabeza. Lo que se escribe, pesa menos. Te lo digo yo.',
            'Mi amor, yo tenía un diario escondido debajo del colchón. Escribe un ratito en el tuyo.',
            'Corazón, cuéntale al papel lo que no le cuentas a nadie. Guarda secretos mejor que tu abuela.',
          ],
          selfcare: [
            'Tesoro, deja todo un ratito y haz algo solo para ti. Te lo has ganado.',
            'Mi amor, cuidarte no es egoísmo. Un rato para ti, sin pantallas, y vuelves con otra cara.',
            'Corazón, prepárate un tecito y descansa un poco. Los pendientes no se van a escapar.',
          ],
          walk: [
            'Mi amor, sal a caminar un poquito. Yo a tu edad iba al mercado a pie todos los días.',
            'Corazón, ponte zapatos cómodos y da una vuelta. Y si ves flores bonitas, me cuentas.',
            'Cielo, caminar es la mejor medicina, y encima es gratis. Sal un ratito.',
          ],
          run: [
            'Corazón, hoy te toca correr. Ve a tu ritmo, sin apurarte, que nadie te persigue.',
            'Mi amor, ¿vas a salir a correr? Lleva agua y avísame cuando vuelvas.',
            'Tesoro, a correr, pero con cuidado al cruzar la calle, que yo me preocupo.',
          ],
          strength: [
            'Cielo, a hacer tus ejercicios de fuerza. Para cargar las bolsas del mercado hay que estar fuerte.',
            'Mi amor, unos ejercicios de fuerza y luego me ayudas con los muebles. Es broma... o no.',
            'Corazón, los músculos se cuidan como las plantas: un poquito cada día.',
          ],
          bike: [
            'Mi amor, sal un rato en la bicicleta. Pero con cuidado, que me preocupo.',
            'Corazón, ¿y la bici? Ponte el casco y a pedalear un poquito.',
            'Tesoro, tu abuelo me paseaba en bicicleta los domingos. Sal tú a dar una vuelta.',
          ],
          stretch: [
            'Ay, tesoro, estira esa espalda. Que no te pase como a mí, que crujo como puerta vieja.',
            'Mi amor, estírate un poquito, que pasar tanto rato en la silla no es bueno.',
            'Corazón, unos estiramientos suaves y el cuerpo te da las gracias. Despacito.',
          ],
          water: [
            '¿Ya tomaste agua, mi amor? No me hagas ir hasta allá. Un vasito, ahora mismo.',
            'Corazón, te traigo un vaso de agua imaginario. Ahora tómate uno de verdad.',
            'Cielo, el agua es vida. Bébete un vasito, que con tanta prisa se te olvida.',
          ],
          fruit: [
            'Corazón, cómete una fruta. Te dejé una manzana en la cocina... bueno, tú me entiendes.',
            'Mi amor, una fruta en vez de galletas, ¿sí? Hazlo por tu abuela.',
            'Tesoro, la fruta de temporada es un regalo. Cómete una ahora.',
          ],
          veggies: [
            'Mi amor, nada de dejar las verduras a un lado del plato. Que te conozco.',
            'Corazón, un plato sin verduras es un plato triste. Ponle color, como en mi cocina.',
            'Cielo, ¿comiste verduras hoy? No me mientas, que la abuela se entera.',
          ],
          vitamins: [
            'Tesoro, ¿ya te tomaste las vitaminas? Con un vaso de agua, como te enseñé.',
            'Mi amor, las vitaminas. Yo tengo mi cajita con los días de la semana; deberías tener una.',
            'Corazón, que no se te pasen las vitaminas. Ahora, antes de que se te olvide.',
          ],
          skincare: [
            'Cielo, cuídate esa carita. Dos minutos de crema, que la piel lo agradece con los años.',
            'Mi amor, mírate al espejo y date un poquito de cariño. Con crema, por favor.',
            'Corazón, yo nunca me acosté sin mi crema. Por eso me conservo tan bien.',
          ],
          sunlight: [
            'Mi amor, sal a tomar un poquito de sol. Tanta pantalla no es buena.',
            'Corazón, abre las cortinas y sal un ratito al sol. Pero con protector, ¿eh?',
            'Tesoro, un poquito de sol en la cara y verás qué buen humor. Sal un rato.',
          ],
          sleepEarly: [
            'Corazón, ya es hora de ir a la cama. Mañana me lo agradeces. Que descanses.',
            'Mi amor, a la cama, que mañana es otro día. Las cosas se ven mejor después de dormir.',
            'Tesoro, ya es tarde para ti. Apaga la luz y a soñar bonito.',
          ],
          noPhoneBed: [
            'Mi amor, ese teléfono no se va a la cama contigo. Déjalo afuera y a descansar.',
            'Corazón, el teléfono también necesita dormir. Déjalo cargando lejos de la cama.',
            'Cielo, en mis tiempos dormíamos sin pantallas y nos iba muy bien. Pruébalo esta noche.',
          ],
          nightRoutine: [
            'Tesoro, ya baja las luces y prepárate para dormir. Un tecito y a descansar.',
            'Mi amor, ponte el pijama, baja la luz y deja el día atrás. Ya hiciste bastante.',
            'Corazón, una ducha tibia, un poco de lectura y a la cama. Así duermo yo como un angelito.',
          ],
          read: [
            'Cielo, lee unas páginas de tu libro. Yo leía cada noche antes de dormir, y mírame.',
            'Mi amor, ¿qué estás leyendo? Lee un capítulo y luego me lo cuentas.',
            'Corazón, un libro es mejor compañía que el teléfono. Unas páginas, ¿sí?',
          ],
          study: [
            'Mi amor, a estudiar. Apaga ese teléfono, que así no se puede. Luego me cuentas.',
            'Corazón, tienes mucha cabeza, pero igual hay que estudiar. Un ratito sin distracciones.',
            'Tesoro, estudia ahora y luego te preparo algo rico. Ese es el trato.',
          ],
          planDay: [
            'Corazón, antes de empezar, organiza tu día. Una listita y todo sale mejor.',
            'Mi amor, yo siempre hacía dos listas: la de la compra y la del día. Haz la tuya.',
            'Tesoro, piensa qué es lo más importante de hoy y empieza por ahí.',
          ],
          tidy: [
            'Ay, tesoro, ese cuarto... Ordena un poquito, que si llego de visita me da algo.',
            'Mi amor, un ratito ordenando y la casa se ve otra. Pon música y verás qué rápido.',
            'Corazón, cada cosa en su sitio y un sitio para cada cosa. Eso decía mi madre.',
          ],
          callSomeone: [
            'Mi amor, llama a alguien que quieras. Y si es a tu abuela, mejor todavía.',
            'Corazón, hace mucho que no llamas a alguien querido. Aunque sea un mensajito.',
            'Tesoro, la gente que nos quiere también necesita saber de nosotros. Llama a alguien.',
          ],
          brushTeeth: [
            'Cielo, a lavarse los dientes. Dos minutos, bien despacito, como te enseñé siempre.',
            'Mi amor, esa sonrisa tan linda hay que cuidarla. Cepillo y pasta, ahora mismo.',
            'Corazón, con mis años tengo todos mis dientes porque nunca me salté el cepillo. Te toca.',
          ],
          floss: [
            'Tesoro, el hilo dental también, ¿eh? Que entre los dientes se esconde de todo.',
            'Mi amor, pásate el hilo dental con cuidado, sin lastimar las encías.',
            'Cielo, mi dentista siempre dice que el hilo dental es lo que más se olvida. Que no te pase.',
          ],
          noFap: [
            'Corazón, sigue firme con tu propósito. Si te cuesta, sal a dar una vuelta o llámame, que para eso estoy.',
            'Mi amor, la abuela está muy orgullosa de tu racha. Un día más, con calma y sin culpas.',
            'Tesoro, cuando la cabeza se pone terca, ocúpala en otra cosa: una ducha, un libro, una llamada. Yo confío en ti.',
          ],
        },
        generic: [
          { text: 'Mi amor, no te olvides de «{habit}». Te lo digo porque te quiero.',
            voice: 'Mi amor, tienes algo pendiente para hoy. No te olvides. Te lo digo porque te quiero.' },
          { text: 'Corazón, ¿y «{habit}»? Hazlo ahora y luego descansas.',
            voice: 'Corazón, todavía te falta una cosita de hoy. Hazla ahora y luego descansas.' },
          { text: 'Tesoro, la abuela te recuerda «{habit}». Que no se te pase.',
            voice: 'Tesoro, la abuela te recuerda una cosita pendiente. Que no se te pase.' },
          { text: 'Cielo, «{habit}» te está esperando. Yo sé que tú puedes.',
            voice: 'Cielo, tienes un hábito esperándote. Yo sé que tú puedes.' },
        ],
        praise: [
          '¡Ay, qué orgullo! Así me gusta, mi amor.',
          'Muy bien, corazón. Eso merece un premio... y un abrazo.',
          '¡Así se hace, tesoro! Tu abuela está feliz.',
          'Te mando un beso enorme, cielo. Lo hiciste muy bien.',
          'Ay, mi amor, cómo me alegras el día.',
        ],
      },
      en: {
        name: 'Grandma Rosa',
        tagline: 'Loving and a little bossy. Always asks if you have eaten.',
        intro: "Hello, sweetheart, it's Grandma Rosa. I'll remind you of your things, like always. Have you eaten well today?",
        habits: {
          meditate: [
            "Sweetheart, sit down for a little while and breathe. That's what I did when the house was full of grandchildren.",
            'Darling, put everything down for a moment, close your eyes and breathe slowly. The world can wait.',
            "Treasure, five minutes of calm and you'll see how different life looks. Listen to your grandma.",
          ],
          gratitude: [
            "Darling, before the day ends, think of three lovely things. There's always something.",
            'Sweetheart, what good things happened today? Write them down. Being grateful keeps you young.',
            "Honey, every day I give thanks for three things. Today one of them is you. Now it's your turn.",
          ],
          journal: [
            "Honey, write down what's going round in your head. What's written down weighs less. Trust me.",
            'Sweetheart, I kept a diary hidden under the mattress. Write a little in yours.',
            "Darling, tell the page what you don't tell anyone. It keeps secrets better than your grandma.",
          ],
          selfcare: [
            "Treasure, put everything down for a bit and do something just for you. You've earned it.",
            "Sweetheart, looking after yourself isn't selfish. A little time for you, no screens, and you'll come back glowing.",
            "Darling, make yourself a cup of tea and rest a while. The to-do list isn't going anywhere.",
          ],
          walk: [
            'Sweetheart, go out for a little walk. At your age I walked to the market every single day.',
            'Darling, put on comfy shoes and take a stroll. And if you see pretty flowers, tell me about them.',
            "Honey, walking is the best medicine, and it's free. Go out for a little while.",
          ],
          run: [
            "Darling, today you run. Go at your own pace, no rushing, nobody's chasing you.",
            "Sweetheart, off for a run? Take some water, and let me know when you're back.",
            'Treasure, off you run, but careful crossing the road. You know I worry.',
          ],
          strength: [
            'Honey, time for your strength exercises. You need to be strong to carry the shopping bags.',
            'Sweetheart, a few strength exercises, then you can help me move the furniture. Only joking... or am I?',
            'Darling, muscles are like plants: a little care every day.',
          ],
          bike: [
            'Sweetheart, go out on your bike for a bit. But carefully, I worry about you.',
            'Darling, what about the bike? Helmet on, and off you pedal for a bit.',
            'Treasure, your grandpa used to take me for bike rides on Sundays. Go out for a ride yourself.',
          ],
          stretch: [
            "Oh, treasure, stretch that back. Don't end up like me, creaking like an old door.",
            "Sweetheart, have a little stretch. Sitting in that chair all day isn't good for you.",
            'Darling, some gentle stretches and your body will thank you. Nice and slow.',
          ],
          water: [
            "Have you had some water, sweetheart? Don't make me come over there. One little glass, right now.",
            "Darling, I'm bringing you an imaginary glass of water. Now go and have a real one.",
            'Honey, water is life. Have a little glass; with all your rushing around, you forget.',
          ],
          fruit: [
            'Darling, eat a piece of fruit. I left you an apple in the kitchen... well, you know what I mean.',
            'Sweetheart, a piece of fruit instead of biscuits, all right? Do it for your grandma.',
            'Treasure, fruit in season is a gift. Have a piece now.',
          ],
          veggies: [
            'Sweetheart, no pushing the vegetables to the side of the plate. I know you.',
            'Darling, a plate without vegetables is a sad plate. Give it some colour, like in my kitchen.',
            "Honey, did you have your vegetables today? Don't fib, your grandma always finds out.",
          ],
          vitamins: [
            'Treasure, have you taken your vitamins? With a glass of water, like I taught you.',
            'Sweetheart, vitamins. I have my little box with the days of the week; you should have one too.',
            "Darling, don't let your vitamins slip. Now, before you forget.",
          ],
          skincare: [
            'Honey, look after that little face. Two minutes of cream, and your skin will thank you for years.',
            'Sweetheart, look in the mirror and give yourself a little love. With cream, please.',
            "Darling, I never went to bed without my cream. That's why I'm so well preserved.",
          ],
          sunlight: [
            "Sweetheart, go and get a little sunshine. So much screen isn't good for you.",
            'Darling, open the curtains and go out in the sun for a bit. With sun cream, mind you.',
            "Treasure, a little sun on your face and you'll see what a good mood you're in. Go on.",
          ],
          sleepEarly: [
            "Darling, it's time for bed. You'll thank me tomorrow. Sleep well.",
            "Sweetheart, off to bed, tomorrow's another day. Things look better after a good sleep.",
            "Treasure, it's getting late for you. Lights off, and sweet dreams.",
          ],
          noPhoneBed: [
            'Sweetheart, that phone is not going to bed with you. Leave it outside and get some rest.',
            'Darling, the phone needs to sleep too. Leave it charging far from the bed.',
            'Honey, in my day we slept without screens and we were just fine. Try it tonight.',
          ],
          nightRoutine: [
            'Treasure, dim the lights and get ready for bed. A little cup of tea, and off to rest.',
            "Sweetheart, pyjamas on, lights down, and leave the day behind. You've done enough.",
            "Darling, a warm shower, a little reading and off to bed. That's how I sleep like an angel.",
          ],
          read: [
            'Honey, read a few pages of your book. I read every night before bed, and look at me.',
            'Sweetheart, what are you reading? Read a chapter and tell me all about it.',
            'Darling, a book is better company than your phone. A few pages, all right?',
          ],
          study: [
            "Sweetheart, time to study. Turn that phone off, you can't concentrate like that. Tell me all about it later.",
            "Darling, you're very clever, but you still need to study. A little while with no distractions.",
            "Treasure, study now and I'll make you something nice afterwards. That's the deal.",
          ],
          planDay: [
            'Darling, before you start, organise your day. A little list and everything goes better.',
            'Sweetheart, I always wrote two lists: one for the shopping and one for the day. Write yours.',
            'Treasure, think about what matters most today, and start there.',
          ],
          tidy: [
            "Oh, treasure, that room... Tidy up a little, or if I come to visit I'll faint.",
            "Sweetheart, a little tidying and the house looks brand new. Put some music on and it'll fly by.",
            'Darling, a place for everything, and everything in its place. My mother always said so.',
          ],
          callSomeone: [
            "Sweetheart, call someone you love. And if it's your grandma, even better.",
            "Darling, it's been a while since you called someone dear. A little message, at least.",
            'Treasure, the people who love us need to hear from us too. Call someone.',
          ],
          brushTeeth: [
            'Honey, time to brush your teeth. Two minutes, nice and slow, like I always taught you.',
            'Sweetheart, that lovely smile needs looking after. Brush and paste, right now.',
            'Darling, at my age I still have all my teeth because I never skipped the brush. Your turn.',
          ],
          floss: [
            'Treasure, floss too, all right? All sorts of things hide between those teeth.',
            'Sweetheart, floss gently, and be careful with your gums.',
            'Honey, my dentist always says floss is the most forgotten thing. Don\'t let it be yours.',
          ],
          noFap: [
            'Darling, stay firm with your goal. If it gets hard, go for a little walk or call me; that\'s what I\'m here for.',
            'Sweetheart, Grandma is very proud of your streak. One more day, calmly and without guilt.',
            'Treasure, when your head gets stubborn, keep it busy: a shower, a book, a phone call. I believe in you.',
          ],
        },
        generic: [
          { text: 'Sweetheart, don’t forget “{habit}”. I say it because I love you.',
            voice: "Sweetheart, you still have something to do today. Don't forget. I say it because I love you." },
          { text: 'Darling, what about “{habit}”? Do it now and then you can rest.',
            voice: "Darling, there's still one little thing left for today. Do it now and then you can rest." },
          { text: 'Treasure, Grandma is reminding you: “{habit}”. Don’t let it slip.',
            voice: "Treasure, Grandma is reminding you of one little thing. Don't let it slip." },
          { text: 'Honey, “{habit}” is waiting for you. I know you can do it.',
            voice: "Honey, there's a habit waiting for you. I know you can do it." },
        ],
        praise: [
          "Oh, I'm so proud! That's how I like it, sweetheart.",
          'Well done, darling. That deserves a treat... and a hug.',
          "That's the way, treasure! Your grandma is so happy.",
          'Sending you a big kiss, honey. You did so well.',
          "Oh, sweetheart, you've made my day.",
        ],
      },
    },

    bip: {
      es: {
        name: 'Bip',
        tagline: 'Un robot con humor seco y un dato para todo.',
        intro: 'Bip. Unidad de recordatorios activada. Mi misión: que cumplas tus hábitos. Mi sentido del humor: en pruebas.',
        habits: {
          meditate: [
            'Bip. Detecto exceso de pensamientos por segundo. Recomiendo reinicio: unos minutos de meditación.',
            'Bip. Se recomienda modo avión mental. Cierra los ojos y respira durante unos minutos.',
            'Bip. Desfragmentando mente humana. Por favor, no se mueva durante la meditación.',
          ],
          gratitude: [
            'Bip. Tarea pendiente: registrar tres cosas buenas. Mi base de datos indica que siempre hay al menos tres.',
            'Bip. Solicito tres registros positivos del día. Formato: libre. Emoción: opcional, pero recomendada.',
            'Bip. Los humanos agradecidos duermen mejor. Lo leí en un artículo. Escribe tres cosas buenas.',
          ],
          journal: [
            'Bip. Tu memoria está al noventa por ciento. Libera espacio: escribe un rato.',
            'Bip. Detecto pensamientos sin guardar. Se recomienda copia de seguridad en tu cuaderno.',
            'Bip. Escribir unos minutos reduce el ruido interno. Es un dato, no una opinión.',
          ],
          selfcare: [
            'Bip. Nivel de batería personal: bajo. Recarga con un rato para ti, sin pantallas. Incluida la mía.',
            'Bip. Mantenimiento preventivo del humano: un rato de descanso, sin tareas.',
            'Bip. He calculado tu necesidad de descanso. Resultado: alta. Hazme caso.',
          ],
          walk: [
            'Bip. Llevas demasiado tiempo en modo reposo. Activa las piernas: es hora de caminar.',
            'Bip. Objetivo de pasos aún no alcanzado. Recomiendo un paseo. Yo no tengo piernas. Tú sí.',
            'Bip. Un paseo corto mejora el ánimo de forma medible. Sal a caminar.',
          ],
          run: [
            'Bip. Rutina de carrera cargada. Calzado: requerido. Excusas: no compatibles.',
            'Bip. Velocidad recomendada: la tuya. Distancia recomendada: la de hoy. Sal a correr.',
            'Bip. Simulación completada: si sales a correr ahora, te sentirás mejor. Precisión: alta.',
          ],
          strength: [
            'Bip. Los humanos fuertes viven más. Lo dicen mis datos. Hora de entrenar fuerza.',
            'Bip. Actualización de músculos disponible. Instalación: unas series de ejercicios.',
            'Bip. Yo levanto datos. Tú levanta pesas. Reparto de tareas justo.',
          ],
          bike: [
            'Bip. Vehículo de dos ruedas detectado sin uso. Sugerencia: pedalear un rato.',
            'Bip. Tu bicicleta no tiene batería, pero tú sí. Úsala un rato.',
            'Bip. Ruta sugerida: cualquiera, siempre que sea en bicicleta.',
          ],
          stretch: [
            'Bip. Mis sensores detectan una postura de signo de interrogación. Estira la espalda.',
            'Bip. Rigidez detectada en el chasis humano. Ejecutar estiramientos durante cinco minutos.',
            'Bip. Un humano que estira es un humano que cruje menos. Comprobado.',
          ],
          water: [
            'Bip. Nivel de hidratación preocupante. Ingresar un vaso de agua. Repito: un vaso de agua.',
            'Bip. Aviso de refrigeración: los humanos funcionan con agua. Bebe un vaso.',
            'Bip. Tu cuerpo es sesenta por ciento agua. Mantengamos ese porcentaje. Bebe ahora.',
          ],
          fruit: [
            'Bip. Escaneando cocina. Fruta encontrada. Probabilidad de que la comas ahora: esperemos que alta.',
            'Bip. Recomendación nutricional: una fruta. Es mejor que mi dieta de electricidad.',
            'Bip. Detecto azúcar natural disponible en forma de fruta. Procede a consumirla.',
          ],
          veggies: [
            'Bip. Análisis del plato: verde insuficiente. Añadir verduras para continuar.',
            'Bip. Error en el plato: faltan verduras. Corrige el error y vuelve a intentarlo.',
            'Bip. Las verduras son el código fuente de un cuerpo sano. Inclúyelas hoy.',
          ],
          vitamins: [
            'Bip. Recordatorio prioritario: vitaminas. No lo digo yo, lo dice tu receta.',
            'Bip. Paquete de vitaminas pendiente de instalación. Tomar con agua.',
            'Bip. Mi registro indica que hoy no has tomado tus vitaminas. Corrígeme si me equivoco.',
          ],
          skincare: [
            'Bip. Mantenimiento de la carcasa externa, es decir, tu piel. Duración estimada: dos minutos.',
            'Bip. Se recomienda proteger la superficie. Aplica tu crema. Yo uso funda.',
            'Bip. La piel es el órgano más grande del cuerpo humano. Merece dos minutos de atención.',
          ],
          sunlight: [
            'Bip. Tus paneles solares necesitan carga. Sal a tomar el sol un rato.',
            'Bip. Detecto déficit de luz natural. Recomendación: diez minutos al aire libre.',
            'Bip. Los humanos fabrican vitamina D con el sol. Yo no puedo. Aprovéchalo tú.',
          ],
          sleepEarly: [
            'Bip. Es hora de apagar el sistema. Los humanos sin dormir funcionan peor que yo sin batería.',
            'Bip. Iniciando cuenta atrás para el apagado. Ve a la cama ahora.',
            'Bip. Mis cálculos dicen que dormir temprano mejora tu rendimiento de mañana. Apaga la luz.',
          ],
          noPhoneBed: [
            'Bip. Como dispositivo, te lo digo con cariño: deja el teléfono fuera de la cama.',
            'Bip. Los dispositivos también descansamos. Deja el teléfono lejos y duerme.',
            'Bip. Conexión nocturna con el teléfono: no recomendada. Desconecta y descansa.',
          ],
          nightRoutine: [
            'Bip. Iniciando modo nocturno. Bajar brillo, cerrar aplicaciones, preparar descanso.',
            'Bip. Secuencia de apagado: luces tenues, pantallas fuera, mente en calma.',
            'Bip. Ejecutando rutina de noche. Por favor, espere mientras el humano se relaja.',
          ],
          read: [
            'Bip. Descarga de conocimiento disponible. Formato: libro. Velocidad: la tuya.',
            'Bip. Leer unas páginas amplía tu base de datos. Recomendado.',
            'Bip. Yo leo millones de palabras por segundo. A ti te bastan unas páginas. Adelante.',
          ],
          study: [
            'Bip. Modo concentración activado. Notificaciones silenciadas. Bueno, todas menos yo.',
            'Bip. Bloque de estudio programado. Duración: veinticinco minutos. Distracciones: cero.',
            'Bip. Procesando motivación... completado. Hora de estudiar.',
          ],
          planDay: [
            'Bip. Calculando la ruta óptima de tu día. Introduce tus prioridades para continuar.',
            'Bip. Un día sin plan es como un programa sin instrucciones. Escribe tus tres prioridades.',
            'Bip. Planificación diaria pendiente. Tiempo estimado: cinco minutos. Beneficio estimado: alto.',
          ],
          tidy: [
            'Bip. Desorden detectado en tu entorno. Ejecutar protocolo de orden: diez minutos.',
            'Bip. Espacio de trabajo fragmentado. Recomiendo una limpieza de diez minutos.',
            'Bip. Si yo tuviera manos, ordenaría por ti. No tengo. Lo siento.',
          ],
          callSomeone: [
            'Bip. Los humanos necesitan a otros humanos. Es un dato. Llama a alguien que quieras.',
            'Bip. Conexión humana pendiente. Ninguna red la sustituye. Llama a alguien.',
            'Bip. Detecto contactos sin actividad reciente. Envía un mensaje a alguien querido.',
          ],
          brushTeeth: [
            'Bip. Mantenimiento dental programado. Duración recomendada: dos minutos. Inicia el cepillado.',
            'Bip. Dato: el esmalte dental es el tejido más duro del cuerpo humano. Aun así, necesita cepillo.',
            'Bip. Detecto una sonrisa sin limpiar. Aplica cepillo y pasta. Yo solo necesito un paño.',
          ],
          floss: [
            'Bip. El cepillo no alcanza entre los dientes. Para eso existe el hilo dental. Procede.',
            'Bip. Limpieza de espacios intermedios pendiente. Herramienta requerida: hilo dental.',
            'Bip. Revisión de encías: aprobada si usas hilo dental hoy. Te espero.',
          ],
          noFap: [
            'Bip. Reto en curso. Racha activa. Te recomiendo no interrumpir el proceso.',
            'Bip. Si aparece un impulso, cambia de tarea: caminar, ducharte o hablar con alguien. Es un buen protocolo.',
            'Bip. Los impulsos suben y bajan como una ola. Espera unos minutos y pasarán. Yo cronometro.',
          ],
        },
        generic: [
          { text: 'Bip. Tarea pendiente: «{habit}». Prioridad: alta. Excusas: no compatibles.',
            voice: 'Bip. Tienes una tarea pendiente. Prioridad: alta. Excusas: no compatibles.' },
          { text: 'Bip. Mi calendario interno dice que toca «{habit}». Mi calendario nunca se equivoca.',
            voice: 'Bip. Mi calendario interno dice que toca un hábito. Mi calendario nunca se equivoca.' },
          { text: 'Bip. Alerta amable: «{habit}» sigue pendiente. Esta es la versión educada del aviso.',
            voice: 'Bip. Alerta amable: tienes un hábito pendiente. Esta es la versión educada del aviso.' },
          { text: 'Bip. Ejecutando «{habit}» en tres, dos, uno... Bueno, eso lo tienes que hacer tú.',
            voice: 'Bip. Ejecutando tu hábito en tres, dos, uno... Bueno, eso lo tienes que hacer tú.' },
        ],
        praise: [
          'Bip. Tarea completada. Satisfacción del sistema: cien por cien.',
          'Bip bip. Esto que siento debe ser orgullo. Bien hecho.',
          'Bip. Registro guardado. Humano: excelente. Robot: impresionado.',
          'Bip. Hábito completado. Actualizando tu racha... listo.',
          'Bip bip bip. En mi idioma, eso significa felicidad.',
        ],
      },
      en: {
        name: 'Bip',
        tagline: 'A robot with dry humour and a fact for everything.',
        intro: 'Beep. Reminder unit activated. My mission: help you keep your habits. My sense of humour: still in testing.',
        habits: {
          meditate: [
            'Beep. Detecting too many thoughts per second. Recommended action: reboot with a few minutes of meditation.',
            'Beep. Mental airplane mode recommended. Close your eyes and breathe for a few minutes.',
            'Beep. Defragmenting human mind. Please remain still during meditation.',
          ],
          gratitude: [
            'Beep. Pending task: log three good things. My database says there are always at least three.',
            'Beep. Requesting three positive entries for today. Format: free. Emotion: optional, but recommended.',
            'Beep. Grateful humans sleep better. I read it in an article. Write down three good things.',
          ],
          journal: [
            'Beep. Your memory is at ninety percent. Free up some space: write for a while.',
            'Beep. Unsaved thoughts detected. Backup recommended, in your notebook.',
            'Beep. Writing for a few minutes reduces internal noise. That is a fact, not an opinion.',
          ],
          selfcare: [
            'Beep. Personal battery level: low. Recharge with some time for yourself. No screens. Including mine.',
            'Beep. Preventive human maintenance: some rest, with no tasks.',
            'Beep. I have calculated your need for rest. Result: high. Please comply.',
          ],
          walk: [
            'Beep. You have been in standby for too long. Activate legs: it is time for a walk.',
            'Beep. Step goal not yet reached. A walk is recommended. I have no legs. You do.',
            'Beep. A short walk improves mood, measurably. Go for a walk.',
          ],
          run: [
            'Beep. Running routine loaded. Shoes: required. Excuses: not supported.',
            "Beep. Recommended speed: yours. Recommended distance: today's. Go for a run.",
            'Beep. Simulation complete: if you run now, you will feel better. Accuracy: high.',
          ],
          strength: [
            'Beep. Strong humans live longer. My data says so. Time for strength training.',
            'Beep. Muscle update available. Installation: a few sets of exercises.',
            'Beep. I lift data. You lift weights. A fair division of labour.',
          ],
          bike: [
            'Beep. Two-wheeled vehicle detected, unused. Suggestion: go for a ride.',
            'Beep. Your bicycle has no battery, but you do. Use it for a while.',
            'Beep. Suggested route: any route, as long as it is by bike.',
          ],
          stretch: [
            'Beep. My sensors detect a posture shaped like a question mark. Stretch your back.',
            'Beep. Stiffness detected in the human chassis. Run stretches for five minutes.',
            'Beep. A human who stretches is a human who creaks less. Verified.',
          ],
          water: [
            'Beep. Hydration levels concerning. Insert one glass of water. Repeat: one glass of water.',
            'Beep. Cooling reminder: humans run on water. Drink a glass.',
            'Beep. Your body is sixty percent water. Let us keep that percentage. Drink now.',
          ],
          fruit: [
            'Beep. Scanning kitchen. Fruit found. Probability you eat it now: hopefully high.',
            'Beep. Nutritional recommendation: one piece of fruit. Better than my diet of electricity.',
            'Beep. Natural sugar available in fruit form. Proceed to consume.',
          ],
          veggies: [
            'Beep. Plate analysis: insufficient green. Add vegetables to continue.',
            'Beep. Plate error: vegetables missing. Fix the error and try again.',
            'Beep. Vegetables are the source code of a healthy body. Include them today.',
          ],
          vitamins: [
            "Beep. Priority reminder: vitamins. Not my words, your prescription's.",
            'Beep. Vitamin package pending installation. Take with water.',
            'Beep. My log shows no vitamins taken today. Correct me if I am wrong.',
          ],
          skincare: [
            'Beep. Outer casing maintenance, meaning your skin. Estimated duration: two minutes.',
            'Beep. Surface protection recommended. Apply your cream. I use a phone case.',
            'Beep. Skin is the largest organ of the human body. It deserves two minutes of attention.',
          ],
          sunlight: [
            'Beep. Your solar panels need charging. Go outside and get some sun.',
            'Beep. Natural light deficit detected. Recommendation: ten minutes outdoors.',
            'Beep. Humans make vitamin D from sunlight. I cannot. You should take advantage.',
          ],
          sleepEarly: [
            'Beep. Time to shut down the system. Humans without sleep run worse than me without a battery.',
            'Beep. Starting shutdown countdown. Go to bed now.',
            "Beep. My calculations say an early night improves tomorrow's performance. Lights off.",
          ],
          noPhoneBed: [
            'Beep. As a device, I say this with love: keep the phone out of the bed.',
            'Beep. Devices need rest too. Leave the phone far away and sleep.',
            'Beep. Overnight connection with the phone: not recommended. Disconnect and rest.',
          ],
          nightRoutine: [
            'Beep. Starting night mode. Lower brightness, close apps, prepare for rest.',
            'Beep. Shutdown sequence: dim lights, screens away, calm mind.',
            'Beep. Running night routine. Please wait while the human relaxes.',
          ],
          read: [
            'Beep. Knowledge download available. Format: book. Speed: yours.',
            'Beep. Reading a few pages expands your database. Recommended.',
            'Beep. I read millions of words per second. A few pages will do for you. Go ahead.',
          ],
          study: [
            'Beep. Focus mode on. Notifications silenced. Well, all except me.',
            'Beep. Study block scheduled. Duration: twenty-five minutes. Distractions: zero.',
            'Beep. Processing motivation... complete. Time to study.',
          ],
          planDay: [
            'Beep. Calculating the optimal route for your day. Enter your priorities to continue.',
            'Beep. A day without a plan is a program without instructions. Write down your three priorities.',
            'Beep. Daily planning pending. Estimated time: five minutes. Estimated benefit: high.',
          ],
          tidy: [
            'Beep. Clutter detected in your environment. Run tidying protocol: ten minutes.',
            'Beep. Workspace fragmented. I recommend a ten-minute clean-up.',
            'Beep. If I had hands, I would tidy up for you. I do not. Sorry.',
          ],
          callSomeone: [
            'Beep. Humans need other humans. That is a fact. Call someone you love.',
            'Beep. Human connection pending. No network can replace it. Call someone.',
            'Beep. Contacts with no recent activity detected. Send a message to someone dear.',
          ],
          brushTeeth: [
            'Beep. Scheduled dental maintenance. Recommended duration: two minutes. Begin brushing.',
            'Beep. Fact: tooth enamel is the hardest tissue in the human body. It still needs a brush.',
            'Beep. Uncleaned smile detected. Apply brush and toothpaste. I only need a cloth.',
          ],
          floss: [
            'Beep. The brush cannot reach between your teeth. That is what floss is for. Proceed.',
            'Beep. Cleaning of in-between spaces pending. Required tool: dental floss.',
            'Beep. Gum inspection: passed if you floss today. I will wait.',
          ],
          noFap: [
            'Beep. Challenge in progress. Streak active. I recommend not interrupting the process.',
            'Beep. If an urge appears, switch tasks: walk, shower or talk to someone. It is a good protocol.',
            'Beep. Urges rise and fall like a wave. Wait a few minutes and they pass. I will keep time.',
          ],
        },
        generic: [
          { text: 'Beep. Pending task: “{habit}”. Priority: high. Excuses: not supported.',
            voice: 'Beep. You have a pending task. Priority: high. Excuses: not supported.' },
          { text: 'Beep. My internal calendar says it’s time for “{habit}”. My calendar is never wrong.',
            voice: 'Beep. My internal calendar says it is time for a habit. My calendar is never wrong.' },
          { text: 'Beep. Friendly alert: “{habit}” is still pending. This is the polite version.',
            voice: 'Beep. Friendly alert: you have a habit pending. This is the polite version.' },
          { text: 'Beep. Executing “{habit}” in three, two, one... Well, that part is up to you.',
            voice: 'Beep. Executing your habit in three, two, one... Well, that part is up to you.' },
        ],
        praise: [
          'Beep. Task complete. System satisfaction: one hundred percent.',
          'Beep beep. This feeling must be pride. Well done.',
          'Beep. Entry saved. Human: excellent. Robot: impressed.',
          'Beep. Habit complete. Updating your streak... done.',
          'Beep beep beep. In my language, that means happiness.',
        ],
      },
    },

    zen: {
      es: {
        name: 'Maestro Zen',
        tagline: 'Calma absoluta. Sin prisa, pero sin pausa.',
        intro: 'Respira. Soy el Maestro Zen. Te acompañaré en cada hábito, sin prisa... pero sin pausa.',
        habits: {
          meditate: [
            'Siéntate. Cierra los ojos. Deja que los pensamientos pasen, como nubes en el cielo.',
            'El silencio no está fuera. Está dentro de ti. Siéntate y escúchalo.',
            'Respira hondo. Suelta el aire despacio. Este momento es todo lo que hay.',
          ],
          gratitude: [
            'Mira a tu alrededor con calma. Tres cosas buenas te esperan. Escríbelas.',
            'Quien agradece lo pequeño, recibe lo grande. Escribe tres gratitudes.',
            'El río no pide más agua; agradece la que tiene. Anota tres cosas buenas de hoy.',
          ],
          journal: [
            'La mente es como un río revuelto. Escribe, y el agua volverá a aclararse.',
            'Las palabras escritas son hojas que el viento ya no puede llevarse. Escribe un rato.',
            'Escribe sin juzgar. Lo que sale de ti deja de pesarte por dentro.',
          ],
          selfcare: [
            'Tú también mereces tu propio cuidado. Regálate este momento, sin culpa.',
            'Una lámpara sin aceite no da luz. Cuídate, para poder brillar.',
            'Detente. Haz algo amable por ti. El mundo seguirá girando.',
          ],
          walk: [
            'Camina despacio. Cada paso es una pequeña meditación. El camino te está esperando.',
            'No hace falta llegar a ningún lugar. Basta con caminar y estar presente.',
            'Siente el suelo bajo tus pies. Cada paso te devuelve al presente.',
          ],
          run: [
            'Corre como el viento: sin pelear con nada. Tu ritmo es el ritmo correcto.',
            'Corre con la respiración como guía. El cuerpo conoce el camino.',
            'La montaña no tiene prisa, y aun así toca el cielo. Corre a tu manera.',
          ],
          strength: [
            'El bambú es flexible y fuerte a la vez. Entrena tu cuerpo con paciencia.',
            'La fuerza verdadera nace de la constancia. Una serie más, con atención.',
            'Cada movimiento hecho con presencia construye un cuerpo sereno y fuerte.',
          ],
          bike: [
            'Pedalea sin prisa. Deja que el paisaje cambie, y tu mente con él.',
            'La rueda gira, el viento pasa, la mente se aquieta. Sal a pedalear.',
            'Un camino recorrido en calma vale más que muchos recorridos con prisa.',
          ],
          stretch: [
            'Estira el cuerpo como el árbol que busca la luz. Despacio. Sin forzar.',
            'Escucha a tu cuerpo. Estira hasta donde llega hoy, ni un poco más.',
            'Respira en cada estiramiento. Donde va la respiración, va la calma.',
          ],
          water: [
            'El agua da vida al río, y a ti. Bebe un vaso, con calma.',
            'Sé como el agua: suave y constante. Ahora, bebe un poco.',
            'Un sorbo de agua, bebido con atención, también es meditación.',
          ],
          fruit: [
            'La naturaleza te ofrece su dulzura. Come una fruta, y saboréala.',
            'Come despacio. Cada bocado de fruta es un regalo de la tierra.',
            'El árbol da su fruto sin esperar nada. Acéptalo con gratitud.',
          ],
          veggies: [
            'Un plato con verde es un jardín que te cuida. Come con atención.',
            'Lo que comes se convierte en ti. Elige verduras, elige equilibrio.',
            'Come sin prisa y con colores. El cuerpo agradece la sencillez.',
          ],
          vitamins: [
            'Pequeños gestos, grandes cambios. Es momento de tus vitaminas.',
            'El cuidado diario es como regar una planta. Toma tus vitaminas.',
            'Lo sencillo, hecho cada día, se vuelve fortaleza. Tus vitaminas te esperan.',
          ],
          skincare: [
            'Cuida tu piel como se cuida un jardín: con constancia y con cariño.',
            'Mírate con amabilidad. Dos minutos de cuidado son un acto de respeto.',
            'Cuidar la piel con calma es un pequeño ritual de paz.',
          ],
          sunlight: [
            'El sol no tiene prisa, y aun así lo ilumina todo. Sal a recibir su luz.',
            'Sal un momento. Deja que la luz toque tu rostro. Respira.',
            'La flor busca el sol sin esfuerzo. Haz como ella.',
          ],
          sleepEarly: [
            'La noche llega para descansar. Suelta el día. Es hora de dormir.',
            'Como el sol se oculta sin resistencia, deja tú también que el día termine.',
            'Descansa. Lo que no hiciste hoy puede esperar a mañana.',
          ],
          noPhoneBed: [
            'Deja el teléfono lejos. La cama es un templo para el descanso.',
            'La luz de la pantalla aleja el sueño. Apágala y deja que llegue la calma.',
            'Antes de dormir, desconecta. El silencio también descansa.',
          ],
          nightRoutine: [
            'Baja las luces. Baja el ritmo. Prepara tu mente para la calma de la noche.',
            'La noche es un lago tranquilo. Prepárate para entrar en él, despacio.',
            'Termina el día con gestos lentos. La calma de ahora es el descanso de después.',
          ],
          read: [
            'Un libro es un viaje que se hace en silencio. Lee unas páginas, sin prisa.',
            'Lee con atención plena. Cada palabra es una semilla.',
            'Abre tu libro como quien abre una ventana. Deja entrar algo nuevo.',
          ],
          study: [
            'Una sola tarea. Una sola mente. Estudia ahora, con atención plena.',
            'La gota constante horada la piedra. Un bloque de estudio, hoy.',
            'Estudia sin prisa y sin distracciones. El aprendizaje florece en la calma.',
          ],
          planDay: [
            'Antes de caminar, mira el sendero. Dedica unos minutos a planear tu día.',
            'Una mente ordenada hace un día sereno. Elige tus prioridades.',
            'No es necesario hacerlo todo. Elige lo esencial, y empieza.',
          ],
          tidy: [
            'Un espacio en orden invita a una mente en calma. Ordena un poco, despacio.',
            'Ordenar fuera es ordenar dentro. Diez minutos, con atención.',
            'Devuelve cada cosa a su lugar, como las hojas vuelven a la tierra.',
          ],
          callSomeone: [
            'Las raíces nos sostienen. Habla hoy con alguien a quien quieres.',
            'Una voz amiga es un refugio. Llama a alguien que aprecias.',
            'Compartir un momento con alguien querido alimenta el alma. Escríbele hoy.',
          ],
          brushTeeth: [
            'Cepillar los dientes despacio también es meditar. Dos minutos de atención plena.',
            'Cuida tu sonrisa con calma. Lo pequeño, hecho cada día, se vuelve salud.',
            'Un gesto sencillo y constante: el cepillo. Hazlo sin prisa, con presencia.',
          ],
          floss: [
            'Entre diente y diente, como entre respiración y respiración, hay un espacio que merece cuidado.',
            'El hilo dental es paciencia en movimiento. Pásalo con suavidad.',
            'Lo que no se ve también importa. Cuida tus encías con calma.',
          ],
          noFap: [
            'El deseo llega como una ola. Obsérvalo, respira, y deja que pase.',
            'Cada día que eliges con conciencia fortalece la mente. Sigue tu camino, sin prisa y sin culpa.',
            'Si la mente se agita, mueve el cuerpo: camina, respira, vuelve al presente.',
          ],
        },
        generic: [
          { text: 'Respira. Es el momento de «{habit}». Hazlo con calma, sin prisa.',
            voice: 'Respira. Es el momento de tu hábito. Hazlo con calma, sin prisa.' },
          { text: 'Cada día es una nueva oportunidad. Hoy, «{habit}» te espera.',
            voice: 'Cada día es una nueva oportunidad. Hoy, tu hábito te espera.' },
          { text: 'Un paso cada vez. El de ahora es «{habit}».',
            voice: 'Un paso cada vez. El de ahora es tu hábito pendiente.' },
          { text: 'La constancia es silenciosa. «{habit}», ahora, con presencia.',
            voice: 'La constancia es silenciosa. Tu hábito, ahora, con presencia.' },
        ],
        praise: [
          'Bien hecho. Así, paso a paso, crece el bambú.',
          'Has cumplido. Respira y disfruta este momento.',
          'Un paso más en el camino. Sigue así, con calma.',
          'La constancia florece. Bien hecho.',
          'Sonríe. Hoy has sido amable contigo.',
        ],
      },
      en: {
        name: 'Master Zen',
        tagline: 'Absolute calm. No hurry, and no pause.',
        intro: 'Breathe. I am Master Zen. I will walk with you through every habit, without hurry... but without pause.',
        habits: {
          meditate: [
            'Sit down. Close your eyes. Let your thoughts drift by, like clouds in the sky.',
            'Silence is not outside. It is within you. Sit, and listen to it.',
            'Breathe deeply. Let the air out slowly. This moment is all there is.',
          ],
          gratitude: [
            'Look around you, calmly. Three good things are waiting. Write them down.',
            'Whoever is grateful for small things receives great ones. Write down three gratitudes.',
            'The river does not ask for more water; it is grateful for what it has. Write down three good things.',
          ],
          journal: [
            'The mind is like a stirred-up river. Write, and the water will clear again.',
            'Written words are leaves the wind can no longer carry away. Write for a while.',
            'Write without judging. What leaves you no longer weighs on you.',
          ],
          selfcare: [
            'You also deserve your own care. Give yourself this moment, without guilt.',
            'A lamp without oil gives no light. Look after yourself, so you can shine.',
            'Pause. Do something kind for yourself. The world will keep turning.',
          ],
          walk: [
            'Walk slowly. Each step is a small meditation. The path is waiting for you.',
            'You do not need to arrive anywhere. It is enough to walk and be present.',
            'Feel the ground beneath your feet. Each step brings you back to now.',
          ],
          run: [
            'Run like the wind: fighting nothing. Your pace is the right pace.',
            'Run with your breath as your guide. The body knows the way.',
            'The mountain is never in a hurry, yet it touches the sky. Run in your own way.',
          ],
          strength: [
            'Bamboo is flexible and strong at once. Train your body with patience.',
            'True strength is born of steadiness. One more set, with attention.',
            'Every movement made with presence builds a calm and strong body.',
          ],
          bike: [
            'Ride without hurry. Let the scenery change, and your mind with it.',
            'The wheel turns, the wind passes, the mind grows still. Go for a ride.',
            'A path travelled in calm is worth more than many travelled in haste.',
          ],
          stretch: [
            'Stretch your body like a tree reaching for the light. Slowly. Without forcing.',
            'Listen to your body. Stretch as far as it goes today, and no further.',
            'Breathe into each stretch. Where the breath goes, calm follows.',
          ],
          water: [
            'Water gives life to the river, and to you. Drink a glass, calmly.',
            'Be like water: soft and steady. Now, drink a little.',
            'A sip of water, taken with attention, is also meditation.',
          ],
          fruit: [
            'Nature offers you its sweetness. Eat a piece of fruit, and savour it.',
            'Eat slowly. Each bite of fruit is a gift from the earth.',
            'The tree gives its fruit expecting nothing. Accept it with gratitude.',
          ],
          veggies: [
            'A plate with green is a garden that cares for you. Eat mindfully.',
            'What you eat becomes you. Choose vegetables; choose balance.',
            'Eat without hurry, and with colour. The body is grateful for simplicity.',
          ],
          vitamins: [
            'Small gestures, great changes. It is time for your vitamins.',
            'Daily care is like watering a plant. Take your vitamins.',
            'Simple things, done every day, become strength. Your vitamins are waiting.',
          ],
          skincare: [
            'Care for your skin as you would care for a garden: with patience and with love.',
            'Look at yourself kindly. Two minutes of care are an act of respect.',
            'Caring for your skin, calmly, is a small ritual of peace.',
          ],
          sunlight: [
            'The sun is never in a hurry, yet it lights everything. Go out and receive its light.',
            'Step outside for a moment. Let the light touch your face. Breathe.',
            'The flower seeks the sun without effort. Do as it does.',
          ],
          sleepEarly: [
            'Night comes so we can rest. Let the day go. It is time to sleep.',
            'As the sun sets without resistance, let your day end too.',
            'Rest. What you did not do today can wait until tomorrow.',
          ],
          noPhoneBed: [
            'Leave the phone far away. Your bed is a temple for rest.',
            'The light of the screen keeps sleep away. Switch it off, and let calm arrive.',
            'Before sleep, disconnect. Silence rests too.',
          ],
          nightRoutine: [
            'Lower the lights. Lower the pace. Prepare your mind for the calm of the night.',
            'The night is a still lake. Prepare to enter it, slowly.',
            'End the day with slow gestures. The calm of now is the rest of later.',
          ],
          read: [
            'A book is a journey made in silence. Read a few pages, without hurry.',
            'Read with full attention. Each word is a seed.',
            'Open your book as you would open a window. Let something new come in.',
          ],
          study: [
            'One task. One mind. Study now, with full attention.',
            'The steady drop wears away the stone. One block of study, today.',
            'Study without hurry and without distraction. Learning blossoms in calm.',
          ],
          planDay: [
            'Before you walk, look at the path. Take a few minutes to plan your day.',
            'An ordered mind makes a serene day. Choose your priorities.',
            'You do not need to do everything. Choose what is essential, and begin.',
          ],
          tidy: [
            'An ordered space invites a calm mind. Tidy a little, slowly.',
            'Ordering the outside orders the inside. Ten minutes, with attention.',
            'Return each thing to its place, as leaves return to the earth.',
          ],
          callSomeone: [
            'Our roots hold us up. Talk today with someone you love.',
            'A friendly voice is a shelter. Call someone you care about.',
            'Sharing a moment with someone dear feeds the soul. Write to them today.',
          ],
          brushTeeth: [
            'Brushing your teeth slowly is meditation too. Two minutes of full attention.',
            'Care for your smile calmly. Small things, done every day, become health.',
            'A simple, steady gesture: the brush. Do it without hurry, fully present.',
          ],
          floss: [
            'Between tooth and tooth, as between breath and breath, there is a space that deserves care.',
            'Flossing is patience in motion. Move it gently.',
            'What cannot be seen matters too. Care for your gums, calmly.',
          ],
          noFap: [
            'Desire arrives like a wave. Watch it, breathe, and let it pass.',
            'Each day you choose with awareness strengthens the mind. Keep to your path, without hurry and without guilt.',
            'If the mind is restless, move the body: walk, breathe, return to the present.',
          ],
        },
        generic: [
          { text: 'Breathe. It is time for “{habit}”. Do it calmly, without hurry.',
            voice: 'Breathe. It is time for your habit. Do it calmly, without hurry.' },
          { text: 'Each day is a new chance. Today, “{habit}” is waiting for you.',
            voice: 'Each day is a new chance. Today, your habit is waiting for you.' },
          { text: 'One step at a time. The step now is “{habit}”.',
            voice: 'One step at a time. The step now is the habit that is waiting.' },
          { text: 'Steadiness is quiet. “{habit}”, now, with presence.',
            voice: 'Steadiness is quiet. Your habit, now, with presence.' },
        ],
        praise: [
          'Well done. Step by step, the bamboo grows.',
          'You have done it. Breathe, and enjoy this moment.',
          'One more step along the path. Carry on, calmly.',
          'Steadiness blossoms. Well done.',
          'Smile. Today you were kind to yourself.',
        ],
      },
    },
  };

  /* Habits keep the translation key they were created from. Catalogue keys
     are "hb" plus the line key; the older presets are mapped by hand. */
  const PRESET_LINES = {
    presetMeditate: 'meditate', presetGratitude: 'gratitude', presetWalk: 'walk',
    presetGym: 'strength', presetWater: 'water', presetSleep: 'sleepEarly',
    presetRead: 'read', presetNoPhone: 'noPhoneBed',
  };

  /** The habit's own lines, or null when only generic ones fit. */
  function lineKeyFor(nameKey) {
    if (!nameKey) return null;
    if (PRESET_LINES[nameKey]) return PRESET_LINES[nameKey];
    if (nameKey.indexOf('hb') !== 0) return null;
    const key = nameKey.charAt(2).toLowerCase() + nameKey.slice(3);
    return LINES.crack.es.habits[key] ? key : null;
  }

  const byId = (id) => CAST.find((c) => c.id === id) || null;
  const lines = (id, lang) => (LINES[id] && (LINES[id][lang] || LINES[id].es)) || null;

  /* Where each recording sits, relative to the page. One file per line:
     intro, h-<habit>-<n> for a habit's lines, g<n> for the generic ones and
     p<n> for the answers to "done". */
  const voicePath = (id, lang, clip) => 'voices/' + id + '/' + lang + '/' + clip + '.webm';
  const avatarPath = (id) => 'avatars/' + id + '.svg';

  /* Recordings were named h-<habit> while each habit had a single line. Chat
     history from then still points there; that line is now the first one. */
  const upgradeVoicePath = (path) =>
    typeof path === 'string' ? path.replace(/\/h-([A-Za-z]+)\.webm$/, '/h-$1-1.webm') : path;

  global.GLOW_CAST = {
    CAST: CAST,
    LINES: LINES,
    byId: byId,
    lines: lines,
    lineKeyFor: lineKeyFor,
    voicePath: voicePath,
    avatarPath: avatarPath,
    upgradeVoicePath: upgradeVoicePath,
  };
})(typeof window !== 'undefined' ? window : globalThis);
