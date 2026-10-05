/* GlowApp — the reminder cast.
   Five original characters who send the reminders as chat messages, each
   with a voice note. Everything a character says lives here, in both
   languages, because the same line is shown in the chat, posted in the
   notification and spoken in the voice note: tools/voices/make-voices.js
   reads this file to record them.

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
          meditate: 'Crack, antes de una final yo cierro los ojos y respiro. Tu turno: unos minutos de calma.',
          gratitude: 'Después de cada partido doy las gracias. Hoy te toca a ti: anota tres cosas buenas del día, crack.',
          journal: 'Crack, hasta los campeones repasan la jugada. Escribe un rato lo que tienes en la cabeza.',
          selfcare: 'Hoy hay descanso activo, crack. Un rato solo para ti, sin pantallas. Así se recupera un campeón.',
          walk: '¡A calentar, crack! Sal a caminar un rato, que las piernas también ganan partidos.',
          run: 'Se escucha el pitazo inicial, crack. ¡Zapatillas puestas y a correr a tu ritmo!',
          strength: 'Crack, hoy toca gimnasio. Cada repetición es un gol que nadie ve, pero que se nota en la final.',
          bike: '¡A la bici, crack! Pedalea un rato y cambia de cancha, que el aire fresco también entrena.',
          stretch: 'Crack, ningún campeón sale a la cancha sin estirar. Suelta la espalda y las piernas, que viene lo bueno.',
          water: '¡Hidratación, crack! Un vaso de agua ahora. En el segundo tiempo me lo vas a agradecer.',
          fruit: 'Crack, la fruta es el combustible del vestuario. Cómete una ahora y seguimos jugando.',
          veggies: 'Plato de campeón, crack: que la verdura juegue de titular, no de suplente.',
          vitamins: 'Crack, la vitamina de hoy es parte del entrenamiento. Tómala ahora y que no se te pase.',
          skincare: 'Hasta los cracks se cuidan la piel después del partido. Dos minutitos y a la foto del trofeo.',
          sunlight: 'Crack, sal a la cancha un rato. Un poco de sol y vuelves con energía de campeón.',
          sleepEarly: 'Crack, mañana hay partido. A la cama temprano, que los campeones se hacen durmiendo bien.',
          noPhoneBed: 'Tarjeta amarilla al teléfono en la cama, crack. Déjalo fuera y descansa como un campeón.',
          nightRoutine: 'Fin del partido, crack. Baja las luces, suelta el día y prepárate para descansar.',
          read: 'Crack, los grandes también estudian al rival. Unas páginas de tu libro y sigues sumando.',
          study: 'Concentración de final, crack. Silencia el teléfono y a estudiar sin distracciones. ¡Tú puedes!',
          planDay: 'Crack, cada partido empieza con una táctica. Cinco minutos para planear el día y salimos a ganar.',
          tidy: 'Vestuario ordenado, cabeza ordenada. Diez minutos ordenando y el espacio queda impecable, crack.',
          callSomeone: 'Crack, nadie gana solo. Llama o escríbele a alguien de tu equipo de la vida.',
        },
        generic: [
          { text: 'Crack, «{habit}» te está esperando en la cancha. ¡A por ello!',
            voice: 'Crack, tienes una jugada pendiente. ¡Sal a la cancha y a por ello!' },
          { text: '¡Vamos, crack! Toca «{habit}». Un gol más para el marcador de hoy.',
            voice: '¡Vamos, crack! Te toca un hábito. Un gol más para el marcador de hoy.' },
        ],
        praise: [
          '¡Golazo, crack! Eso es mentalidad de campeón.',
          '¡Qué jugada! Así se gana un partido, crack.',
        ],
      },
      en: {
        name: 'The Champ',
        tagline: 'Football champion. Talks to you like a teammate before the final.',
        intro: "Hey, champ! From today I'm on your team. I call the play, you score. Let's go!",
        habits: {
          meditate: 'Champ, before every final I close my eyes and breathe. Your turn: a few minutes of calm.',
          gratitude: 'After every match I say thanks. Your turn, champ: write down three good things from today.',
          journal: "Champ, even the greats rewatch the game. Write down what's on your mind for a bit.",
          selfcare: "Rest day, champ. Some time just for you, no screens. That's how champions recover.",
          walk: 'Warm-up time, champ! Head out for a walk. Legs win matches too.',
          run: "There's the whistle, champ! Shoes on, and run at your own pace.",
          strength: 'Gym time, champ. Every rep is a goal nobody sees, but it shows in the final.',
          bike: 'On the bike, champ! Ride for a while. Fresh air is training too.',
          stretch: "Champ, no champion steps on the pitch without stretching. Loosen up, the good part's coming.",
          water: "Hydration, champ! One glass of water, right now. You'll thank me in the second half.",
          fruit: "Champ, fruit is the locker room's fuel. Grab one now and keep playing.",
          veggies: "Champion's plate, champ: vegetables in the starting line-up, not on the bench.",
          vitamins: "Champ, today's vitamin is part of training. Take it now, don't let it slip.",
          skincare: 'Even champs look after their skin after the match. Two minutes, then the trophy photo.',
          sunlight: "Champ, get out on the pitch for a bit. Some sun and you'll be back with champion energy.",
          sleepEarly: 'Champ, big match tomorrow. Early to bed. Champions are made sleeping well.',
          noPhoneBed: 'Yellow card for the phone in bed, champ. Leave it outside and rest like a pro.',
          nightRoutine: 'Full time, champ. Dim the lights, let the day go, and get ready to rest.',
          read: 'Champ, the greats study the game. A few pages of your book and you keep scoring.',
          study: "Final-match focus, champ. Silence the phone and study, no distractions. You've got this!",
          planDay: 'Champ, every match starts with tactics. Five minutes to plan the day, then we go and win it.',
          tidy: 'Tidy locker room, tidy mind. Ten minutes of tidying and the place looks spotless, champ.',
          callSomeone: 'Champ, nobody wins alone. Call or text someone from your team in life.',
        },
        generic: [
          { text: 'Champ, “{habit}” is waiting for you on the pitch. Go get it!',
            voice: "Champ, you've got a play waiting for you. Get on the pitch and go get it!" },
          { text: 'Come on, champ! Time for “{habit}”. One more goal on today’s scoreboard.',
            voice: "Come on, champ! Time for a habit. One more goal on today's scoreboard." },
        ],
        praise: [
          "What a goal, champ! That's a winner's mindset.",
          "What a play! That's how you win a match, champ.",
        ],
      },
    },

    narrator: {
      es: {
        name: 'El Narrador',
        tagline: 'Convierte cada recordatorio en una pequeña historia de misterio.',
        intro: 'Soy El Narrador. A partir de hoy, cada recordatorio llegará con una historia... si te atreves a escucharla.',
        habits: {
          meditate: 'Cuentan que quien nunca se detiene a respirar acaba oyendo susurros en su cabeza. Unos minutos de silencio los callan.',
          gratitude: 'Existe un cuaderno que solo brilla cuando alguien escribe tres cosas buenas. Haz que brille hoy.',
          journal: 'Las ideas que no se escriben vagan por la casa de noche, buscando dueño. Atrápalas en el papel.',
          selfcare: 'El cansancio es un fantasma paciente. Solo se marcha cuando te regalas un rato para ti.',
          walk: 'Dicen que hay un sendero que solo aparece para quien sale a caminar. Hoy podría aparecer para ti.',
          run: 'Algo te persigue: la versión de ti que se quedó en el sofá. Corre, y que no te alcance.',
          strength: 'En lo profundo del gimnasio, las pesas murmuran tu nombre. No las hagas esperar más.',
          bike: 'Una bicicleta abandonada gira sus ruedas sola, esperando a alguien. Ese alguien eres tú.',
          stretch: '¿Oyes ese crujido? No es la casa. Es tu espalda pidiendo que estires. Hazle caso.',
          water: 'Dicen que quien olvida su vaso de agua empieza a secarse, lentamente, como una planta olvidada. Bebe agua ya.',
          fruit: 'En la cocina, una fruta espera desde hace días. Si no la comes tú, nadie sabe qué pasará.',
          veggies: 'Las verduras que nadie come se reúnen de noche a planear su venganza. Mejor ponlas en tu plato.',
          vitamins: 'Un frasco de vitaminas tiembla en el estante. Lleva horas esperando que lo recuerdes.',
          skincare: 'El espejo lo recuerda todo. Dale hoy dos minutos de cuidado que valga la pena recordar.',
          sunlight: 'Las criaturas de la sombra odian la luz del sol. Sal un rato, que no te confundan con una.',
          sleepEarly: 'Cada minuto que le robas a la noche, la noche te lo cobra mañana. Ve a dormir temprano.',
          noPhoneBed: 'Dicen que el brillo del teléfono en la cama atrae a las ojeras. Déjalo fuera del cuarto.',
          nightRoutine: 'La casa empieza a apagarse. Baja las luces, aleja las pantallas, y deja que la calma entre.',
          read: 'Hay un libro que te espera con la página marcada. Dicen que se pone triste si no vuelves.',
          study: 'Cuentan que el conocimiento solo aparece en el silencio. Apaga las notificaciones y empieza a estudiar.',
          planDay: 'Quien no planea su día se pierde en él, como en un laberinto. Traza tu mapa ahora.',
          tidy: 'Ese montón de cosas en la esquina... ¿se ha movido? Mejor ordénalo antes de averiguarlo.',
          callSomeone: 'Alguien piensa en ti en este momento. Rompe el silencio: escríbele o llámale hoy.',
        },
        generic: [
          { text: 'Dicen que «{habit}» lleva un rato esperando en la oscuridad... Ve antes de que se impaciente.',
            voice: 'Dicen que hay un hábito esperándote en la oscuridad... Ve antes de que se impaciente.' },
          { text: 'Esta historia aún no tiene final. Lo escribes tú, con «{habit}».',
            voice: 'Esta historia aún no tiene final. Lo escribes tú, ahora mismo.' },
        ],
        praise: [
          'Y así, la maldición se rompió. Bien hecho.',
          'La historia de hoy tiene un final feliz. Por ahora...',
        ],
      },
      en: {
        name: 'The Narrator',
        tagline: 'Turns every reminder into a little spooky story.',
        intro: 'I am The Narrator. From today, every reminder will come with a story... if you dare to listen.',
        habits: {
          meditate: 'They say those who never stop to breathe end up hearing whispers in their head. A few quiet minutes will silence them.',
          gratitude: 'There is a notebook that only glows when someone writes down three good things. Make it glow today.',
          journal: 'Thoughts that are never written down wander the house at night, looking for their owner. Catch them on paper.',
          selfcare: 'Tiredness is a patient ghost. It only leaves when you give yourself some time of your own.',
          walk: 'They say there is a path that only appears to those who go out walking. Today it might appear for you.',
          run: "Something is chasing you: the version of you that stayed on the couch. Run, and don't let it catch you.",
          strength: "Deep in the gym, the weights are whispering your name. Don't keep them waiting.",
          bike: 'An abandoned bicycle spins its wheels all by itself, waiting for someone. That someone is you.',
          stretch: "Do you hear that creak? It's not the house. It's your back, begging you to stretch. Listen to it.",
          water: 'They say whoever forgets their glass of water begins to dry up, slowly, like a forgotten plant. Drink some water now.',
          fruit: "In the kitchen, a piece of fruit has been waiting for days. If you don't eat it, nobody knows what will happen.",
          veggies: 'Uneaten vegetables gather at night to plot their revenge. Better put them on your plate.',
          vitamins: 'A bottle of vitamins trembles on the shelf. It has waited for hours for you to remember it.',
          skincare: 'The mirror remembers everything. Give it two minutes of care worth remembering.',
          sunlight: 'Creatures of the shadows hate sunlight. Step outside for a while, so no one mistakes you for one.',
          sleepEarly: 'Every minute you steal from the night, the night collects tomorrow. Go to bed early.',
          noPhoneBed: "They say a phone's glow in bed summons dark circles. Leave it outside the room.",
          nightRoutine: 'The house is going quiet. Dim the lights, put the screens away, and let the calm come in.',
          read: "A book is waiting for you, its page still marked. They say it grows sad if you don't come back.",
          study: 'Legend has it that knowledge only appears in silence. Turn off notifications and start studying.',
          planDay: "Whoever doesn't plan their day gets lost in it, like in a maze. Draw your map now.",
          tidy: 'That pile of things in the corner... did it just move? Better tidy it before you find out.',
          callSomeone: 'Someone is thinking of you right now. Break the silence: call or text them today.',
        },
        generic: [
          { text: 'They say “{habit}” has been waiting in the dark for a while... Go before it grows impatient.',
            voice: 'They say a habit is waiting for you in the dark... Go before it grows impatient.' },
          { text: 'This story has no ending yet. You write it, with “{habit}”.',
            voice: 'This story has no ending yet. You write it, right now.' },
        ],
        praise: [
          'And so, the curse was broken. Well done.',
          "Today's story has a happy ending. For now...",
        ],
      },
    },

    grandma: {
      es: {
        name: 'Abuela Rosa',
        tagline: 'Cariñosa y un poco regañona. Siempre pregunta si comiste.',
        intro: 'Hola, mi amor, soy la abuela Rosa. Yo te voy a recordar tus cosas, como siempre. ¿Comiste bien hoy?',
        habits: {
          meditate: 'Corazón, siéntate un ratito y respira. Así hacía yo cuando la casa estaba llena de nietos.',
          gratitude: 'Mi amor, antes de que se acabe el día, piensa en tres cosas bonitas. Siempre hay alguna.',
          journal: 'Cielo, escribe lo que te ronda la cabeza. Lo que se escribe, pesa menos. Te lo digo yo.',
          selfcare: 'Tesoro, deja todo un ratito y haz algo solo para ti. Te lo has ganado.',
          walk: 'Mi amor, sal a caminar un poquito. Yo a tu edad iba al mercado a pie todos los días.',
          run: 'Corazón, hoy te toca correr. Ve a tu ritmo, sin apurarte, que nadie te persigue.',
          strength: 'Cielo, a hacer tus ejercicios de fuerza. Para cargar las bolsas del mercado hay que estar fuerte.',
          bike: 'Mi amor, sal un rato en la bicicleta. Pero con cuidado, que me preocupo.',
          stretch: 'Ay, tesoro, estira esa espalda. Que no te pase como a mí, que crujo como puerta vieja.',
          water: '¿Ya tomaste agua, mi amor? No me hagas ir hasta allá. Un vasito, ahora mismo.',
          fruit: 'Corazón, cómete una fruta. Te dejé una manzana en la cocina... bueno, tú me entiendes.',
          veggies: 'Mi amor, nada de dejar las verduras a un lado del plato. Que te conozco.',
          vitamins: 'Tesoro, ¿ya te tomaste las vitaminas? Con un vaso de agua, como te enseñé.',
          skincare: 'Cielo, cuídate esa carita. Dos minutos de crema, que la piel lo agradece con los años.',
          sunlight: 'Mi amor, sal a tomar un poquito de sol. Tanta pantalla no es buena.',
          sleepEarly: 'Corazón, ya es hora de ir a la cama. Mañana me lo agradeces. Que descanses.',
          noPhoneBed: 'Mi amor, ese teléfono no se va a la cama contigo. Déjalo afuera y a descansar.',
          nightRoutine: 'Tesoro, ya baja las luces y prepárate para dormir. Un tecito y a descansar.',
          read: 'Cielo, lee unas páginas de tu libro. Yo leía cada noche antes de dormir, y mírame.',
          study: 'Mi amor, a estudiar. Apaga ese teléfono, que así no se puede. Luego me cuentas.',
          planDay: 'Corazón, antes de empezar, organiza tu día. Una listita y todo sale mejor.',
          tidy: 'Ay, tesoro, ese cuarto... Ordena un poquito, que si llego de visita me da algo.',
          callSomeone: 'Mi amor, llama a alguien que quieras. Y si es a tu abuela, mejor todavía.',
        },
        generic: [
          { text: 'Mi amor, no te olvides de «{habit}». Te lo digo porque te quiero.',
            voice: 'Mi amor, tienes algo pendiente para hoy. No te olvides. Te lo digo porque te quiero.' },
          { text: 'Corazón, ¿y «{habit}»? Hazlo ahora y luego descansas.',
            voice: 'Corazón, todavía te falta una cosita de hoy. Hazla ahora y luego descansas.' },
        ],
        praise: [
          '¡Ay, qué orgullo! Así me gusta, mi amor.',
          'Muy bien, corazón. Eso merece un premio... y un abrazo.',
        ],
      },
      en: {
        name: 'Grandma Rosa',
        tagline: 'Loving and a little bossy. Always asks if you have eaten.',
        intro: "Hello, sweetheart, it's Grandma Rosa. I'll remind you of your things, like always. Have you eaten well today?",
        habits: {
          meditate: "Sweetheart, sit down for a little while and breathe. That's what I did when the house was full of grandchildren.",
          gratitude: "Darling, before the day ends, think of three lovely things. There's always something.",
          journal: "Honey, write down what's going round in your head. What's written down weighs less. Trust me.",
          selfcare: "Treasure, put everything down for a bit and do something just for you. You've earned it.",
          walk: 'Sweetheart, go out for a little walk. At your age I walked to the market every single day.',
          run: "Darling, today you run. Go at your own pace, no rushing, nobody's chasing you.",
          strength: 'Honey, time for your strength exercises. You need to be strong to carry the shopping bags.',
          bike: 'Sweetheart, go out on your bike for a bit. But carefully, I worry about you.',
          stretch: "Oh, treasure, stretch that back. Don't end up like me, creaking like an old door.",
          water: "Have you had some water, sweetheart? Don't make me come over there. One little glass, right now.",
          fruit: 'Darling, eat a piece of fruit. I left you an apple in the kitchen... well, you know what I mean.',
          veggies: 'Sweetheart, no pushing the vegetables to the side of the plate. I know you.',
          vitamins: 'Treasure, have you taken your vitamins? With a glass of water, like I taught you.',
          skincare: 'Honey, look after that little face. Two minutes of cream, and your skin will thank you for years.',
          sunlight: "Sweetheart, go and get a little sunshine. So much screen isn't good for you.",
          sleepEarly: "Darling, it's time for bed. You'll thank me tomorrow. Sleep well.",
          noPhoneBed: 'Sweetheart, that phone is not going to bed with you. Leave it outside and get some rest.',
          nightRoutine: 'Treasure, dim the lights and get ready for bed. A little cup of tea, and off to rest.',
          read: 'Honey, read a few pages of your book. I read every night before bed, and look at me.',
          study: "Sweetheart, time to study. Turn that phone off, you can't concentrate like that. Tell me all about it later.",
          planDay: 'Darling, before you start, organise your day. A little list and everything goes better.',
          tidy: "Oh, treasure, that room... Tidy up a little, or if I come to visit I'll faint.",
          callSomeone: "Sweetheart, call someone you love. And if it's your grandma, even better.",
        },
        generic: [
          { text: 'Sweetheart, don’t forget “{habit}”. I say it because I love you.',
            voice: "Sweetheart, you still have something to do today. Don't forget. I say it because I love you." },
          { text: 'Darling, what about “{habit}”? Do it now and then you can rest.',
            voice: "Darling, there's still one little thing left for today. Do it now and then you can rest." },
        ],
        praise: [
          "Oh, I'm so proud! That's how I like it, sweetheart.",
          'Well done, darling. That deserves a treat... and a hug.',
        ],
      },
    },

    bip: {
      es: {
        name: 'Bip',
        tagline: 'Un robot con humor seco y un dato para todo.',
        intro: 'Bip. Unidad de recordatorios activada. Mi misión: que cumplas tus hábitos. Mi sentido del humor: en pruebas.',
        habits: {
          meditate: 'Bip. Detecto exceso de pensamientos por segundo. Recomiendo reinicio: unos minutos de meditación.',
          gratitude: 'Bip. Tarea pendiente: registrar tres cosas buenas. Mi base de datos indica que siempre hay al menos tres.',
          journal: 'Bip. Tu memoria está al noventa por ciento. Libera espacio: escribe un rato.',
          selfcare: 'Bip. Nivel de batería personal: bajo. Recarga con un rato para ti, sin pantallas. Incluida la mía.',
          walk: 'Bip. Llevas demasiado tiempo en modo reposo. Activa las piernas: es hora de caminar.',
          run: 'Bip. Rutina de carrera cargada. Calzado: requerido. Excusas: no compatibles.',
          strength: 'Bip. Los humanos fuertes viven más. Lo dicen mis datos. Hora de entrenar fuerza.',
          bike: 'Bip. Vehículo de dos ruedas detectado sin uso. Sugerencia: pedalear un rato.',
          stretch: 'Bip. Mis sensores detectan una postura de signo de interrogación. Estira la espalda.',
          water: 'Bip. Nivel de hidratación preocupante. Ingresar un vaso de agua. Repito: un vaso de agua.',
          fruit: 'Bip. Escaneando cocina. Fruta encontrada. Probabilidad de que la comas ahora: esperemos que alta.',
          veggies: 'Bip. Análisis del plato: verde insuficiente. Añadir verduras para continuar.',
          vitamins: 'Bip. Recordatorio prioritario: vitaminas. No lo digo yo, lo dice tu receta.',
          skincare: 'Bip. Mantenimiento de la carcasa externa, es decir, tu piel. Duración estimada: dos minutos.',
          sunlight: 'Bip. Tus paneles solares necesitan carga. Sal a tomar el sol un rato.',
          sleepEarly: 'Bip. Es hora de apagar el sistema. Los humanos sin dormir funcionan peor que yo sin batería.',
          noPhoneBed: 'Bip. Como dispositivo, te lo digo con cariño: deja el teléfono fuera de la cama.',
          nightRoutine: 'Bip. Iniciando modo nocturno. Bajar brillo, cerrar aplicaciones, preparar descanso.',
          read: 'Bip. Descarga de conocimiento disponible. Formato: libro. Velocidad: la tuya.',
          study: 'Bip. Modo concentración activado. Notificaciones silenciadas. Bueno, todas menos yo.',
          planDay: 'Bip. Calculando la ruta óptima de tu día. Introduce tus prioridades para continuar.',
          tidy: 'Bip. Desorden detectado en tu entorno. Ejecutar protocolo de orden: diez minutos.',
          callSomeone: 'Bip. Los humanos necesitan a otros humanos. Es un dato. Llama a alguien que quieras.',
        },
        generic: [
          { text: 'Bip. Tarea pendiente: «{habit}». Prioridad: alta. Excusas: no compatibles.',
            voice: 'Bip. Tienes una tarea pendiente. Prioridad: alta. Excusas: no compatibles.' },
          { text: 'Bip. Mi calendario interno dice que toca «{habit}». Mi calendario nunca se equivoca.',
            voice: 'Bip. Mi calendario interno dice que toca un hábito. Mi calendario nunca se equivoca.' },
        ],
        praise: [
          'Bip. Tarea completada. Satisfacción del sistema: cien por cien.',
          'Bip bip. Esto que siento debe ser orgullo. Bien hecho.',
        ],
      },
      en: {
        name: 'Bip',
        tagline: 'A robot with dry humour and a fact for everything.',
        intro: 'Beep. Reminder unit activated. My mission: help you keep your habits. My sense of humour: still in testing.',
        habits: {
          meditate: 'Beep. Detecting too many thoughts per second. Recommended action: reboot with a few minutes of meditation.',
          gratitude: 'Beep. Pending task: log three good things. My database says there are always at least three.',
          journal: 'Beep. Your memory is at ninety percent. Free up some space: write for a while.',
          selfcare: 'Beep. Personal battery level: low. Recharge with some time for yourself. No screens. Including mine.',
          walk: 'Beep. You have been in standby for too long. Activate legs: it is time for a walk.',
          run: 'Beep. Running routine loaded. Shoes: required. Excuses: not supported.',
          strength: 'Beep. Strong humans live longer. My data says so. Time for strength training.',
          bike: 'Beep. Two-wheeled vehicle detected, unused. Suggestion: go for a ride.',
          stretch: 'Beep. My sensors detect a posture shaped like a question mark. Stretch your back.',
          water: 'Beep. Hydration levels concerning. Insert one glass of water. Repeat: one glass of water.',
          fruit: 'Beep. Scanning kitchen. Fruit found. Probability you eat it now: hopefully high.',
          veggies: 'Beep. Plate analysis: insufficient green. Add vegetables to continue.',
          vitamins: "Beep. Priority reminder: vitamins. Not my words, your prescription's.",
          skincare: 'Beep. Outer casing maintenance, meaning your skin. Estimated duration: two minutes.',
          sunlight: 'Beep. Your solar panels need charging. Go outside and get some sun.',
          sleepEarly: 'Beep. Time to shut down the system. Humans without sleep run worse than me without a battery.',
          noPhoneBed: 'Beep. As a device, I say this with love: keep the phone out of the bed.',
          nightRoutine: 'Beep. Starting night mode. Lower brightness, close apps, prepare for rest.',
          read: 'Beep. Knowledge download available. Format: book. Speed: yours.',
          study: 'Beep. Focus mode on. Notifications silenced. Well, all except me.',
          planDay: 'Beep. Calculating the optimal route for your day. Enter your priorities to continue.',
          tidy: 'Beep. Clutter detected in your environment. Run tidying protocol: ten minutes.',
          callSomeone: 'Beep. Humans need other humans. That is a fact. Call someone you love.',
        },
        generic: [
          { text: 'Beep. Pending task: “{habit}”. Priority: high. Excuses: not supported.',
            voice: 'Beep. You have a pending task. Priority: high. Excuses: not supported.' },
          { text: 'Beep. My internal calendar says it’s time for “{habit}”. My calendar is never wrong.',
            voice: 'Beep. My internal calendar says it is time for a habit. My calendar is never wrong.' },
        ],
        praise: [
          'Beep. Task complete. System satisfaction: one hundred percent.',
          'Beep beep. This feeling must be pride. Well done.',
        ],
      },
    },

    zen: {
      es: {
        name: 'Maestro Zen',
        tagline: 'Calma absoluta. Sin prisa, pero sin pausa.',
        intro: 'Respira. Soy el Maestro Zen. Te acompañaré en cada hábito, sin prisa... pero sin pausa.',
        habits: {
          meditate: 'Siéntate. Cierra los ojos. Deja que los pensamientos pasen, como nubes en el cielo.',
          gratitude: 'Mira a tu alrededor con calma. Tres cosas buenas te esperan. Escríbelas.',
          journal: 'La mente es como un río revuelto. Escribe, y el agua volverá a aclararse.',
          selfcare: 'Tú también mereces tu propio cuidado. Regálate este momento, sin culpa.',
          walk: 'Camina despacio. Cada paso es una pequeña meditación. El camino te está esperando.',
          run: 'Corre como el viento: sin pelear con nada. Tu ritmo es el ritmo correcto.',
          strength: 'El bambú es flexible y fuerte a la vez. Entrena tu cuerpo con paciencia.',
          bike: 'Pedalea sin prisa. Deja que el paisaje cambie, y tu mente con él.',
          stretch: 'Estira el cuerpo como el árbol que busca la luz. Despacio. Sin forzar.',
          water: 'El agua da vida al río, y a ti. Bebe un vaso, con calma.',
          fruit: 'La naturaleza te ofrece su dulzura. Come una fruta, y saboréala.',
          veggies: 'Un plato con verde es un jardín que te cuida. Come con atención.',
          vitamins: 'Pequeños gestos, grandes cambios. Es momento de tus vitaminas.',
          skincare: 'Cuida tu piel como se cuida un jardín: con constancia y con cariño.',
          sunlight: 'El sol no tiene prisa, y aun así lo ilumina todo. Sal a recibir su luz.',
          sleepEarly: 'La noche llega para descansar. Suelta el día. Es hora de dormir.',
          noPhoneBed: 'Deja el teléfono lejos. La cama es un templo para el descanso.',
          nightRoutine: 'Baja las luces. Baja el ritmo. Prepara tu mente para la calma de la noche.',
          read: 'Un libro es un viaje que se hace en silencio. Lee unas páginas, sin prisa.',
          study: 'Una sola tarea. Una sola mente. Estudia ahora, con atención plena.',
          planDay: 'Antes de caminar, mira el sendero. Dedica unos minutos a planear tu día.',
          tidy: 'Un espacio en orden invita a una mente en calma. Ordena un poco, despacio.',
          callSomeone: 'Las raíces nos sostienen. Habla hoy con alguien a quien quieres.',
        },
        generic: [
          { text: 'Respira. Es el momento de «{habit}». Hazlo con calma, sin prisa.',
            voice: 'Respira. Es el momento de tu hábito. Hazlo con calma, sin prisa.' },
          { text: 'Cada día es una nueva oportunidad. Hoy, «{habit}» te espera.',
            voice: 'Cada día es una nueva oportunidad. Hoy, tu hábito te espera.' },
        ],
        praise: [
          'Bien hecho. Así, paso a paso, crece el bambú.',
          'Has cumplido. Respira y disfruta este momento.',
        ],
      },
      en: {
        name: 'Master Zen',
        tagline: 'Absolute calm. No hurry, and no pause.',
        intro: 'Breathe. I am Master Zen. I will walk with you through every habit, without hurry... but without pause.',
        habits: {
          meditate: 'Sit down. Close your eyes. Let your thoughts drift by, like clouds in the sky.',
          gratitude: 'Look around you, calmly. Three good things are waiting. Write them down.',
          journal: 'The mind is like a stirred-up river. Write, and the water will clear again.',
          selfcare: 'You also deserve your own care. Give yourself this moment, without guilt.',
          walk: 'Walk slowly. Each step is a small meditation. The path is waiting for you.',
          run: 'Run like the wind: fighting nothing. Your pace is the right pace.',
          strength: 'Bamboo is flexible and strong at once. Train your body with patience.',
          bike: 'Ride without hurry. Let the scenery change, and your mind with it.',
          stretch: 'Stretch your body like a tree reaching for the light. Slowly. Without forcing.',
          water: 'Water gives life to the river, and to you. Drink a glass, calmly.',
          fruit: 'Nature offers you its sweetness. Eat a piece of fruit, and savour it.',
          veggies: 'A plate with green is a garden that cares for you. Eat mindfully.',
          vitamins: 'Small gestures, great changes. It is time for your vitamins.',
          skincare: 'Care for your skin as you would care for a garden: with patience and with love.',
          sunlight: 'The sun is never in a hurry, yet it lights everything. Go out and receive its light.',
          sleepEarly: 'Night comes so we can rest. Let the day go. It is time to sleep.',
          noPhoneBed: 'Leave the phone far away. Your bed is a temple for rest.',
          nightRoutine: 'Lower the lights. Lower the pace. Prepare your mind for the calm of the night.',
          read: 'A book is a journey made in silence. Read a few pages, without hurry.',
          study: 'One task. One mind. Study now, with full attention.',
          planDay: 'Before you walk, look at the path. Take a few minutes to plan your day.',
          tidy: 'An ordered space invites a calm mind. Tidy a little, slowly.',
          callSomeone: 'Our roots hold us up. Talk today with someone you love.',
        },
        generic: [
          { text: 'Breathe. It is time for “{habit}”. Do it calmly, without hurry.',
            voice: 'Breathe. It is time for your habit. Do it calmly, without hurry.' },
          { text: 'Each day is a new chance. Today, “{habit}” is waiting for you.',
            voice: 'Each day is a new chance. Today, your habit is waiting for you.' },
        ],
        praise: [
          'Well done. Step by step, the bamboo grows.',
          'You have done it. Breathe, and enjoy this moment.',
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

  /** The habit's own line, or null when only a generic one fits. */
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
     intro, h-<habit>, g1/g2 for the generic lines, p1/p2 for praise. */
  const voicePath = (id, lang, clip) => 'voices/' + id + '/' + lang + '/' + clip + '.webm';
  const avatarPath = (id) => 'avatars/' + id + '.svg';

  global.GLOW_CAST = {
    CAST: CAST,
    LINES: LINES,
    byId: byId,
    lines: lines,
    lineKeyFor: lineKeyFor,
    voicePath: voicePath,
    avatarPath: avatarPath,
  };
})(typeof window !== 'undefined' ? window : globalThis);
