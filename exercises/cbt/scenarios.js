// Fictional practice cases. Judge choices using only the facts shown.
// Keep scoring fields hidden until the learner has chosen.
export const TRANSFER_CASES = [
  {
    "id": "prototype-local",
    "family": "revised-prototype",
    "title": "One small picture",
    "scene": "Mina makes a little book. A teacher marks one page: “Make this picture bigger.” Mina puts the whole book away. She thinks every page must be wrong.",
    "facts": [
      "Only page 4 has a mark.",
      "The note asks for a bigger picture on page 4.",
      "The teacher has not checked the other pages."
    ],
    "claim": "Every page in this book is wrong.",
    "options": [
      {
        "id": "a",
        "label": "Make every page again before showing the book",
        "effect": "Mina starts changing pages the teacher has not checked.",
        "valid": false,
        "reasonIds": []
      },
      {
        "id": "b",
        "label": "Keep the known problem on page 4",
        "effect": "Mina knows one picture needs work. Other pages still need checking.",
        "valid": true,
        "reasonIds": [
          "r2"
        ]
      },
      {
        "id": "c",
        "label": "Make that picture bigger, then ask for another check",
        "effect": "Mina fixes the marked picture. The next check can find other problems.",
        "valid": true,
        "reasonIds": [
          "r3"
        ]
      },
      {
        "id": "d",
        "label": "Mark the other pages as checked and right",
        "effect": "Mina calls pages right before anyone has checked them.",
        "valid": false,
        "reasonIds": []
      }
    ],
    "reasons": [
      {
        "id": "r1",
        "text": "One wrong picture means every page is wrong."
      },
      {
        "id": "r2",
        "text": "The note is about one picture. Other pages are not checked."
      },
      {
        "id": "r3",
        "text": "Mina can fix this picture without judging every page."
      },
      {
        "id": "r4",
        "text": "No mark on a page means it has passed."
      }
    ],
    "explanation": "Mina can keep the thought small or fix the picture first. Both help. The other pages might need work, or they might not. They have not been checked yet.",
    "skill": "scope",
    "principle": "Let one fact speak for what it shows."
  },
  {
    "id": "prototype-pattern",
    "family": "revised-prototype",
    "title": "Three rows with the same mistake",
    "scene": "Jon makes a bead row with three beads. The rule says four. Two older rows have the same mistake. Jon thinks the helper just wants a change this once.",
    "facts": [
      "Three checks on different days show three beads, not four.",
      "Each task used the same rule: four beads per row.",
      "A correct row and a counting guide are ready."
    ],
    "claim": "This is just one helper asking for a change this once.",
    "options": [
      {
        "id": "a",
        "label": "Copy the four-bead example, then check this row",
        "effect": "Jon practises the count he missed and checks his new row.",
        "valid": true,
        "reasonIds": [
          "r1"
        ]
      },
      {
        "id": "b",
        "label": "Leave the two older checks out",
        "effect": "Jon ignores two checks that show the same mistake.",
        "valid": false,
        "reasonIds": []
      },
      {
        "id": "c",
        "label": "Say this counting mistake has happened three times",
        "effect": "Jon keeps the repeated mistake in view without judging every skill.",
        "valid": true,
        "reasonIds": [
          "r3"
        ]
      },
      {
        "id": "d",
        "label": "Say Jon will never make a correct bead row",
        "effect": "Jon turns three mistakes into a guess about every future try.",
        "valid": false,
        "reasonIds": []
      }
    ],
    "reasons": [
      {
        "id": "r1",
        "text": "Jon can practise the missed step with a clear example."
      },
      {
        "id": "r2",
        "text": "Making the same mistake means practice cannot help."
      },
      {
        "id": "r3",
        "text": "Three checks on different days found the same mistake."
      },
      {
        "id": "r4",
        "text": "Only the newest check tells us anything."
      }
    ],
    "explanation": "This mistake has happened more than once. Jon can name it or start practising that step. Neither means he is bad at everything or cannot learn.",
    "skill": "update",
    "principle": "Keep a real repeated problem in view."
  },
  {
    "id": "reply-unknown",
    "family": "delayed-reply",
    "title": "No answer yet",
    "scene": "Lian sends a drawing at ten. At eleven, the teacher has not replied. The teacher promised an answer by three tomorrow. Lian thinks the drawing has been turned down.",
    "facts": [
      "The teacher has until three tomorrow to answer.",
      "There is no answer yet: no yes and no no.",
      "Lian does not need to decide anything before then."
    ],
    "claim": "No answer yet means the teacher said no to the drawing.",
    "options": [
      {
        "id": "a",
        "label": "Send the same question every ten minutes",
        "effect": "Lian sends more messages but learns nothing new about the drawing.",
        "valid": false,
        "reasonIds": []
      },
      {
        "id": "b",
        "label": "Mark the drawing as chosen for the show",
        "effect": "Lian writes down a yes that the teacher has not given.",
        "valid": false,
        "reasonIds": []
      },
      {
        "id": "c",
        "label": "Throw the drawing away because the teacher said no",
        "effect": "Lian loses the drawing before an answer arrives.",
        "valid": false,
        "reasonIds": []
      },
      {
        "id": "d",
        "label": "Keep the drawing and check at three tomorrow",
        "effect": "Lian leaves the answer open and picks a clear time to return.",
        "valid": true,
        "reasonIds": [
          "r2"
        ]
      }
    ],
    "reasons": [
      {
        "id": "r1",
        "text": "A slow answer tells us the answer will be no."
      },
      {
        "id": "r2",
        "text": "There is still time for an answer. Nothing needs deciding sooner."
      },
      {
        "id": "r3",
        "text": "Waiting means the teacher will say yes."
      }
    ],
    "explanation": "Lian does not know the answer yet. Keep the drawing and come back at the promised time. Waiting tells us neither yes nor no.",
    "skill": "uncertainty",
    "principle": "Leave room for “I do not know yet.”"
  },
  {
    "id": "reply-boundary",
    "family": "delayed-reply",
    "title": "A clear no for tonight",
    "scene": "Omar asks a helper to check his picture tonight. She says, “I cannot check this picture. I am away tonight.” Another helper can check tomorrow. The picture is due Friday.",
    "facts": [
      "The first helper said she cannot check this picture.",
      "She is away tonight.",
      "Another helper can check tomorrow, before Friday."
    ],
    "claim": "If Omar asks more nicely tonight, this helper will check it.",
    "options": [
      {
        "id": "a",
        "label": "Ask the same helper again more nicely tonight",
        "effect": "Omar asks her to change a clear answer she has already given.",
        "valid": false,
        "reasonIds": []
      },
      {
        "id": "b",
        "label": "Ask the other helper to check tomorrow",
        "effect": "Omar finds a check that can happen before the picture is due.",
        "valid": true,
        "reasonIds": [
          "r3"
        ]
      },
      {
        "id": "c",
        "label": "Decide this helper will never help Omar again",
        "effect": "Omar turns one no into a guess about every future request.",
        "valid": false,
        "reasonIds": []
      },
      {
        "id": "d",
        "label": "Treat her answer as if she has not replied yet",
        "effect": "Omar misses the clear answer already in her message.",
        "valid": false,
        "reasonIds": []
      }
    ],
    "reasons": [
      {
        "id": "r1",
        "text": "A nicer request can always turn a no into a yes."
      },
      {
        "id": "r2",
        "text": "Saying no this time means saying no every time."
      },
      {
        "id": "r3",
        "text": "She gave a clear no. Another helper has time."
      }
    ],
    "explanation": "Here, Omar has an answer. He can respect it and ask the other helper. A no for this picture does not mean a no forever.",
    "skill": "action",
    "principle": "Hear a clear answer and choose another way."
  },
  {
    "id": "attachment-practical",
    "family": "missing-attachment",
    "title": "The missing name card",
    "scene": "Pia sends a picture to art club. A note comes back: “Please add your name card.” Her name card is ready. There is still time to send the picture.",
    "facts": [
      "The picture needs a name card.",
      "Pia has the right name card ready.",
      "Art club is still taking pictures."
    ],
    "claim": "No belief claim is needed here.",
    "options": [
      {
        "id": "a",
        "label": "Add the name card and send the picture again",
        "effect": "Art club now has the missing card and can check the picture.",
        "valid": true,
        "reasonIds": [
          "r1"
        ]
      },
      {
        "id": "b",
        "label": "Ask if the helper is upset with Pia",
        "effect": "The name card is still missing. The question does not add it.",
        "valid": false,
        "reasonIds": []
      },
      {
        "id": "c",
        "label": "Think of more reasons why the card is missing",
        "effect": "Pia makes more guesses but does not add the ready card.",
        "valid": false,
        "reasonIds": []
      },
      {
        "id": "d",
        "label": "Wait for the picture to pass without adding the card",
        "effect": "The picture still lacks the name card it needs.",
        "valid": false,
        "reasonIds": []
      }
    ],
    "reasons": [
      {
        "id": "r1",
        "text": "We know what is missing and have it ready."
      },
      {
        "id": "r2",
        "text": "Every returned picture needs a check of someone’s thoughts."
      },
      {
        "id": "r3",
        "text": "The missing card will appear without anyone adding it."
      }
    ],
    "explanation": "Pia has a small job to do: add the card. There is no extra thought to test here. Doing the ready step is enough to move on.",
    "skill": "action",
    "principle": "Do the clear next step when that is enough."
  },
  {
    "id": "attachment-added-claim",
    "family": "missing-attachment",
    "title": "The name is there now",
    "scene": "Theo adds the missing name card to his drawing. Art club says, “We have all the parts now.” No one has judged it yet. Theo thinks forgetting the card means he will lose.",
    "facts": [
      "Theo has added the name card.",
      "The note only says all the parts are there.",
      "No one has judged the drawing yet."
    ],
    "claim": "Forgetting the name card means this drawing will lose.",
    "options": [
      {
        "id": "a",
        "label": "Treat “all parts are here” as “you have won”",
        "effect": "Theo adds a win that the note does not promise.",
        "valid": false,
        "reasonIds": []
      },
      {
        "id": "b",
        "label": "Keep sending the same name card again",
        "effect": "Extra copies do not tell Theo how the drawing will do.",
        "valid": false,
        "reasonIds": []
      },
      {
        "id": "c",
        "label": "Keep two facts: the card is added; judging comes later",
        "effect": "Theo keeps the fixed problem apart from the unknown result.",
        "valid": true,
        "reasonIds": [
          "r2"
        ]
      },
      {
        "id": "d",
        "label": "Take the drawing out before the expected loss",
        "effect": "Theo leaves the contest before anyone has judged his drawing.",
        "valid": false,
        "reasonIds": []
      }
    ],
    "reasons": [
      {
        "id": "r1",
        "text": "Having every part is the same as winning."
      },
      {
        "id": "r2",
        "text": "The note settles the missing card, not who will win."
      },
      {
        "id": "r3",
        "text": "One forgotten card decides the result even after it is added."
      }
    ],
    "explanation": "The card problem is fixed. The contest result is still unknown. Fixing one thing does not tell Theo the answer to a different question.",
    "skill": "update",
    "principle": "A fix only settles the thing it fixes."
  },
  {
    "id": "rumour-one-origin",
    "family": "repeated-rumour",
    "title": "Three copies of one photo",
    "scene": "Nia sees three friends share the same photo of a playroom sign. It says the room closes early. The date is cut off. Nia can open the full sign.",
    "facts": [
      "All three messages use the same photo.",
      "The photo cuts off the date.",
      "Nia can open the full sign to see the date."
    ],
    "claim": "Three different checks show the playroom closes early today.",
    "options": [
      {
        "id": "a",
        "label": "Count the copies as three different checks",
        "effect": "Nia counts one unchecked sign three times.",
        "valid": false,
        "reasonIds": []
      },
      {
        "id": "b",
        "label": "Ignore the sign because copied messages are never true",
        "effect": "Nia ignores a sign that might matter before looking at it.",
        "valid": false,
        "reasonIds": []
      },
      {
        "id": "c",
        "label": "Ask another friend to send the same photo",
        "effect": "Another copy still leaves the date cut off.",
        "valid": false,
        "reasonIds": []
      },
      {
        "id": "d",
        "label": "Open the full sign and check the date",
        "effect": "Nia sees the missing date and can check whether it means today.",
        "valid": true,
        "reasonIds": [
          "r3"
        ]
      }
    ],
    "reasons": [
      {
        "id": "r1",
        "text": "Each person sharing a photo makes it a new check."
      },
      {
        "id": "r2",
        "text": "A copied message can never be right."
      },
      {
        "id": "r3",
        "text": "These copies share one sign and all hide its date."
      }
    ],
    "explanation": "Three copies are still one sign. The sign may be right, but Nia needs its date. Open the full sign before deciding what it tells her.",
    "skill": "sources",
    "principle": "Check where a message first came from."
  },
  {
    "id": "rumour-independent",
    "family": "repeated-rumour",
    "title": "Two tries with blue ink",
    "scene": "Bea prints a blue picture at nine. Dev prints another at ten. Both come out smudged. Each keeps a note and the picture. The printer has not been fixed between tries.",
    "facts": [
      "The pictures and notes come from two separate print tries.",
      "Both tries used the same blue ink and print settings.",
      "Clean blue pictures are needed. Another printer is ready."
    ],
    "claim": "There is a real problem with this printer’s blue ink now.",
    "options": [
      {
        "id": "a",
        "label": "Keep the concern and use the other printer today",
        "effect": "The picture gets a different printer while this one needs checking.",
        "valid": true,
        "reasonIds": [
          "r1"
        ]
      },
      {
        "id": "b",
        "label": "Ignore one try because the pictures look alike",
        "effect": "One real, separate check is lost just because its result matches.",
        "valid": false,
        "reasonIds": []
      },
      {
        "id": "c",
        "label": "Decide every printer in the room is broken",
        "effect": "Two tries on one printer become a claim about untested printers.",
        "valid": false,
        "reasonIds": []
      },
      {
        "id": "d",
        "label": "Use the same printer and expect clean ink this time",
        "effect": "The job uses a printer with a problem no one has fixed.",
        "valid": false,
        "reasonIds": []
      }
    ],
    "reasons": [
      {
        "id": "r1",
        "text": "Two separate tries found the same blue-ink problem."
      },
      {
        "id": "r2",
        "text": "Matching results must be copies of the same try."
      },
      {
        "id": "r3",
        "text": "Trying one printer tells us whether every printer works."
      }
    ],
    "explanation": "These are two tries, not two copies of one try. They support a concern about this printer now. They say nothing about every other printer.",
    "skill": "sources",
    "principle": "Matching results can come from separate checks."
  },
  {
    "id": "feedback-question",
    "family": "short-feedback",
    "title": "“Please work on this”",
    "scene": "Ren makes a poster with three parts. The teacher writes, “Please work on this.” Ren wonders whether the parts are in the wrong order, facts are missing, or both.",
    "facts": [
      "The note does not say what needs work.",
      "The teacher has time for one short question.",
      "Each poster part has a name Ren can point to."
    ],
    "claim": "The note probably means the poster parts are in the wrong order.",
    "options": [
      {
        "id": "a",
        "label": "Ask, “Do you think I can make a good poster?”",
        "effect": "Ren may get kind words but still not learn which part needs work.",
        "valid": false,
        "reasonIds": []
      },
      {
        "id": "b",
        "label": "Ask, “Which part needs work, and what needs changing?”",
        "effect": "The teacher can point to the part and explain the needed change.",
        "valid": true,
        "reasonIds": [
          "r2"
        ]
      },
      {
        "id": "c",
        "label": "Move all the parts before finding out what needs work",
        "effect": "Ren changes the order before learning whether that is the problem.",
        "valid": false,
        "reasonIds": []
      },
      {
        "id": "d",
        "label": "Take the short note as proof the order is wrong",
        "effect": "Ren uses the note’s length to guess what the teacher meant.",
        "valid": false,
        "reasonIds": []
      }
    ],
    "reasons": [
      {
        "id": "r1",
        "text": "A short note tells us which part is wrong."
      },
      {
        "id": "r2",
        "text": "Naming a part and its needed change helps tell problems apart."
      },
      {
        "id": "r3",
        "text": "Kind words tell Ren exactly which part needs fixing."
      }
    ],
    "explanation": "A useful question can guide Ren’s next change. The note’s length does not tell Ren whether order, missing facts, or both need work.",
    "skill": "prediction",
    "principle": "Ask a question that helps choose the next step."
  },
  {
    "id": "feedback-kind-vague",
    "family": "short-feedback",
    "title": "Kind words about a picture",
    "scene": "Sasha asks whether a picture fits the art show’s size rules. The helper replies, “Thanks for working so hard!” The size guide is ready. No one has measured the picture.",
    "facts": [
      "The helper thanks Sasha for working hard.",
      "The reply does not say the picture is the right size.",
      "The guide gives sizes Sasha can measure."
    ],
    "claim": "The kind reply means the picture fits the size rules.",
    "options": [
      {
        "id": "a",
        "label": "Mark every size rule as checked and passed",
        "effect": "Sasha calls measurements right before anyone has taken them.",
        "valid": false,
        "reasonIds": []
      },
      {
        "id": "b",
        "label": "Decide the kind words really mean the picture is wrong",
        "effect": "Sasha swaps one guess about the reply for another.",
        "valid": false,
        "reasonIds": []
      },
      {
        "id": "c",
        "label": "Measure the picture and check the size guide",
        "effect": "Sasha compares the real picture with the sizes it needs to meet.",
        "valid": true,
        "reasonIds": [
          "r1"
        ]
      },
      {
        "id": "d",
        "label": "Ask, “Does any part still need a size change?”",
        "effect": "Sasha asks for the size answer missing from the kind reply.",
        "valid": true,
        "reasonIds": [
          "r3"
        ]
      }
    ],
    "reasons": [
      {
        "id": "r1",
        "text": "Measuring the picture can answer the size question."
      },
      {
        "id": "r2",
        "text": "Kind words always mean every rule has been met."
      },
      {
        "id": "r3",
        "text": "A thank-you and an answer about size are different things."
      },
      {
        "id": "r4",
        "text": "No clear yes must mean no."
      }
    ],
    "explanation": "The thanks can be real while the size is still unchecked. Sasha can measure the picture or ask directly about its size. Either can help answer the question.",
    "skill": "sources",
    "principle": "Use the answer given. Do not add another one."
  },
  {
    "id": "first-step-available",
    "family": "difficult-first-step",
    "title": "The empty story book",
    "scene": "Ellis wants to make a story book. The three page titles are ready, but the whole story is not. Starting feels hard. Ellis thinks every word must be ready first.",
    "facts": [
      "The three page titles are ready.",
      "Ellis can write the titles and change them later.",
      "The whole story is not needed to add the titles."
    ],
    "claim": "Ellis cannot start until every word of the story is ready.",
    "options": [
      {
        "id": "a",
        "label": "Write the three titles and look at what comes next",
        "effect": "The book has a start. Ellis can see which words are still missing.",
        "valid": true,
        "reasonIds": [
          "r2"
        ]
      },
      {
        "id": "b",
        "label": "Wait until starting feels completely easy",
        "effect": "The book stays empty and the same job remains.",
        "valid": false,
        "reasonIds": []
      },
      {
        "id": "c",
        "label": "Keep planning every word without opening the book",
        "effect": "Ellis repeats the big plan without trying the ready first step.",
        "valid": false,
        "reasonIds": []
      },
      {
        "id": "d",
        "label": "Promise that starting will make all hard feelings go away",
        "effect": "The plan adds a promise about feelings that no one has tested.",
        "valid": false,
        "reasonIds": []
      }
    ],
    "reasons": [
      {
        "id": "r1",
        "text": "A good first step must make every hard feeling vanish."
      },
      {
        "id": "r2",
        "text": "One small step is ready and can be changed later."
      },
      {
        "id": "r3",
        "text": "Missing story words make every first step impossible."
      }
    ],
    "explanation": "Ellis can try the titles even while starting feels hard. That tests whether a start is possible. It does not promise the rest will be easy.",
    "skill": "action",
    "principle": "Try one ready step and see what it changes."
  },
  {
    "id": "first-step-blocked",
    "family": "difficult-first-step",
    "title": "The locked art box",
    "scene": "Asha needs to paint with the club’s special paint. It is in a locked box. Only the helper has the key. The task says to use this paint, not another kind.",
    "facts": [
      "The needed paint is inside a locked box.",
      "Only the helper has the key.",
      "The task needs this paint, not a different kind."
    ],
    "claim": "The locked box stops Asha from starting the painting right now.",
    "options": [
      {
        "id": "a",
        "label": "Keep pulling the locked lid",
        "effect": "The lid stays locked because Asha still has no key.",
        "valid": false,
        "reasonIds": []
      },
      {
        "id": "b",
        "label": "Say the problem is that Asha does not want to paint",
        "effect": "The thought misses the real locked box that blocks the painting.",
        "valid": false,
        "reasonIds": []
      },
      {
        "id": "c",
        "label": "Ask the helper to unlock it, then start",
        "effect": "Asha asks for the missing help and knows when painting can begin.",
        "valid": true,
        "reasonIds": [
          "r3"
        ]
      },
      {
        "id": "d",
        "label": "Use different paint and call the task finished",
        "effect": "Asha uses paint that does not meet this task’s clear rule.",
        "valid": false,
        "reasonIds": []
      }
    ],
    "reasons": [
      {
        "id": "r1",
        "text": "Making a move smaller can open any locked box."
      },
      {
        "id": "r2",
        "text": "Any paint can be swapped in without checking the task."
      },
      {
        "id": "r3",
        "text": "Asha needs a key that only the helper can use."
      }
    ],
    "explanation": "This is a real block. Wanting to paint more will not open the box. The next step is to ask for the key holder’s help.",
    "skill": "action",
    "principle": "Find out what a step needs before trying it."
  },
  {
    "id": "variable-noise",
    "family": "variable-task-result",
    "title": "One slower tidy-up",
    "scene": "Kai sorts the same toy set with the same plan each day. It takes four to six minutes. Today it takes six. Kai thinks the plan no longer works.",
    "facts": [
      "The last ten tries took four to six minutes each.",
      "Today’s try took six minutes.",
      "The toys and sorting rules have not changed."
    ],
    "claim": "This sorting plan no longer works.",
    "options": [
      {
        "id": "a",
        "label": "Drop the plan because today was one of the slowest",
        "effect": "Kai drops the plan after a time seen in earlier tries.",
        "valid": false,
        "reasonIds": []
      },
      {
        "id": "b",
        "label": "Keep today’s time and compare the next planned tries",
        "effect": "Kai saves the result and checks whether later similar tries keep changing.",
        "valid": true,
        "reasonIds": [
          "r1"
        ]
      },
      {
        "id": "c",
        "label": "Erase today’s time so the plan looks better",
        "effect": "A real result goes missing from the record.",
        "valid": false,
        "reasonIds": []
      },
      {
        "id": "d",
        "label": "Say the plan will always work just as well",
        "effect": "Kai turns a few past tries into a promise about every future try.",
        "valid": false,
        "reasonIds": []
      }
    ],
    "reasons": [
      {
        "id": "r1",
        "text": "Six minutes fits earlier tries. One time does not show a change."
      },
      {
        "id": "r2",
        "text": "The newest try matters more than every other try put together."
      },
      {
        "id": "r3",
        "text": "We should erase odd-looking results before deciding."
      }
    ],
    "explanation": "Keep today’s time. It fits the earlier times. That alone is no reason to drop the plan or promise it will work forever. Compare the next planned tries.",
    "skill": "update",
    "principle": "Compare this try with how past tries varied."
  },
  {
    "id": "variable-condition-change",
    "family": "variable-task-result",
    "title": "A bigger toy box",
    "scene": "Kai now packs toys in boxes twice as big. The old plan leaves gaps. The new picture guide shows one extra pad to fill them. Kai calls this another slow day.",
    "facts": [
      "The boxes are now twice as big.",
      "The new guide calls for one extra pad.",
      "The old plan has no extra pad."
    ],
    "claim": "The old plan needs no change. Some days just take longer.",
    "options": [
      {
        "id": "a",
        "label": "Try the old plan many more times before reading the guide",
        "effect": "Kai keeps packing without the extra pad the new boxes need.",
        "valid": false,
        "reasonIds": []
      },
      {
        "id": "b",
        "label": "Throw away every step from the old plan",
        "effect": "Kai loses steps that might still help along with the changed step.",
        "valid": false,
        "reasonIds": []
      },
      {
        "id": "c",
        "label": "Say Kai only needs to feel more sure",
        "effect": "The bigger box still lacks the needed pad.",
        "valid": false,
        "reasonIds": []
      },
      {
        "id": "d",
        "label": "Add the extra pad and check one bigger box",
        "effect": "Kai makes the stated change and checks how the new box fits.",
        "valid": true,
        "reasonIds": [
          "r2"
        ]
      }
    ],
    "reasons": [
      {
        "id": "r1",
        "text": "Past slow days mean new boxes cannot need a new step."
      },
      {
        "id": "r2",
        "text": "Both the box size and its packing rule have changed."
      },
      {
        "id": "r3",
        "text": "If one thing changes, every old step becomes useless."
      }
    ],
    "explanation": "This time, a needed part has changed. Kai can use the new guide now. Many more tries with a missing pad would not fix the gap.",
    "skill": "update",
    "principle": "Change the plan when a needed part changes."
  },
  {
    "id": "requirement-new",
    "family": "changed-requirement",
    "title": "The book rule changed",
    "scene": "Art club allowed books up to ten pages yesterday. Today its new dated note says five. Ivo made eight pages using yesterday’s note. Today the club asks for a shorter book.",
    "facts": [
      "Yesterday’s saved note allows books up to ten pages.",
      "Today’s new note allows books up to five pages.",
      "Ivo’s book has eight pages. He can make a shorter copy."
    ],
    "claim": "This proves Ivo ignored the rule when he made the book.",
    "options": [
      {
        "id": "a",
        "label": "Note the changed rule and make a shorter copy",
        "effect": "Ivo keeps the rule change clear and makes a book for today’s limit.",
        "valid": true,
        "reasonIds": [
          "r3"
        ]
      },
      {
        "id": "b",
        "label": "Insist yesterday’s rule must still count today",
        "effect": "The eight-page book still exceeds today’s five-page limit.",
        "valid": false,
        "reasonIds": []
      },
      {
        "id": "c",
        "label": "Say the new dated note must be wrong",
        "effect": "Ivo rejects a clear new note without anything showing it is wrong.",
        "valid": false,
        "reasonIds": []
      },
      {
        "id": "d",
        "label": "Decide Ivo never follows any rules",
        "effect": "A changed rule becomes a guess about everything Ivo has ever done.",
        "valid": false,
        "reasonIds": []
      }
    ],
    "reasons": [
      {
        "id": "r1",
        "text": "Today’s answer tells us which rule existed yesterday."
      },
      {
        "id": "r2",
        "text": "Following yesterday’s rule means today’s rule does not matter."
      },
      {
        "id": "r3",
        "text": "Eight pages fit yesterday’s rule. Today’s rule asks for fewer."
      }
    ],
    "explanation": "Ivo followed the rule he had then. The book still needs to fit the rule now. Both can be true: he followed the old rule, and a change is needed.",
    "skill": "scope",
    "principle": "Use the rule from then to judge a past choice."
  },
  {
    "id": "requirement-unchanged",
    "family": "changed-requirement",
    "title": "The book rule stayed the same",
    "scene": "Sol makes an eight-page book. Art club asks for five pages or fewer. Sol thinks the rule changed. But last week’s saved note and today’s note both say five pages.",
    "facts": [
      "Last week’s saved note allows books up to five pages.",
      "Today’s note still allows books up to five pages.",
      "Sol’s book has eight pages. A shorter copy is possible."
    ],
    "claim": "Art club changed the page rule after Sol made the book.",
    "options": [
      {
        "id": "a",
        "label": "Say the rule changed even though both notes match",
        "effect": "Sol adds a rule change that neither note shows.",
        "valid": false,
        "reasonIds": []
      },
      {
        "id": "b",
        "label": "Keep the rule as five and make a shorter copy",
        "effect": "Sol uses the matching notes and fixes the book’s extra pages.",
        "valid": true,
        "reasonIds": [
          "r1"
        ]
      },
      {
        "id": "c",
        "label": "Leave last week’s note out of the check",
        "effect": "Sol loses a note that can test the claimed rule change.",
        "valid": false,
        "reasonIds": []
      },
      {
        "id": "d",
        "label": "Decide every book Sol makes will be turned down",
        "effect": "One fixable page count becomes a guess about every future book.",
        "valid": false,
        "reasonIds": []
      }
    ],
    "reasons": [
      {
        "id": "r1",
        "text": "Both notes say five. Sol’s eight-page book has more than five."
      },
      {
        "id": "r2",
        "text": "Keep a guess even when the facts it needs are missing."
      },
      {
        "id": "r3",
        "text": "One wrong page count tells us what happens to every later book."
      }
    ],
    "explanation": "Rules can change, but these two notes match. Sol can change the guess and fix the page count. There is no need to invent a change in the rule.",
    "skill": "update",
    "principle": "Let the facts change your guess."
  },
  {
    "id": "invitation-known-limit",
    "family": "missed-invitation",
    "title": "The art table is full",
    "scene": "Mae wants a place at art club’s table. The helper says all places went to people who asked first. Mae is on the wait list. Another art day opens next month.",
    "facts": [
      "The helper says there is no place for Mae right now.",
      "Places went to people in the order they asked.",
      "Mae can wait for a space or try next month."
    ],
    "claim": "Mae does not have a place at this art table right now.",
    "options": [
      {
        "id": "a",
        "label": "Decide a place is already saved for Mae",
        "effect": "Mae plans around a place the helper said is not there.",
        "valid": false,
        "reasonIds": []
      },
      {
        "id": "b",
        "label": "Decide Mae can never join another art day",
        "effect": "One full table becomes a guess about every future art day.",
        "valid": false,
        "reasonIds": []
      },
      {
        "id": "c",
        "label": "Keep that fact; wait for a space or try next month",
        "effect": "Mae plans with the real limit and the two paths still open.",
        "valid": true,
        "reasonIds": [
          "r2"
        ]
      },
      {
        "id": "d",
        "label": "Keep asking whether the helper really means “full”",
        "effect": "Mae repeats an answered question without any sign that a place has opened.",
        "valid": false,
        "reasonIds": []
      }
    ],
    "reasons": [
      {
        "id": "r1",
        "text": "We should swap an upsetting fact for a happier thought."
      },
      {
        "id": "r2",
        "text": "There is no place now. The other choices do not change that."
      },
      {
        "id": "r3",
        "text": "One full table tells us about every future art day."
      }
    ],
    "explanation": "Mae has no place right now. That can feel sad and still be true. A wait-list plan or a later art day helps without pretending she already has a place.",
    "skill": "action",
    "principle": "Keep the real problem and choose an open path."
  },
  {
    "id": "invitation-unresolved",
    "family": "missed-invitation",
    "title": "Still waiting for the art message",
    "scene": "Jules has no art-club message yet. A friend has one. The club sends messages through Friday, and today is Thursday. Jules’s page says, “Still deciding.”",
    "facts": [
      "The club can send messages until Friday.",
      "Jules’s page says, “Still deciding.”",
      "One other person has a message."
    ],
    "claim": "No message yet means Jules has been left out.",
    "options": [
      {
        "id": "a",
        "label": "Leave the list because the club has said no",
        "effect": "Jules leaves while the club is still deciding.",
        "valid": false,
        "reasonIds": []
      },
      {
        "id": "b",
        "label": "Write down that Jules is sure to get a place",
        "effect": "Jules turns an unfinished choice into a promised yes.",
        "valid": false,
        "reasonIds": []
      },
      {
        "id": "c",
        "label": "Keep comparing messages until everyone has the same answer",
        "effect": "Other people’s messages do not settle Jules’s unfinished answer.",
        "valid": false,
        "reasonIds": []
      },
      {
        "id": "d",
        "label": "Leave the answer open and check after Friday",
        "effect": "Jules stays on the list and chooses a useful time to ask again.",
        "valid": true,
        "reasonIds": [
          "r3"
        ]
      }
    ],
    "reasons": [
      {
        "id": "r1",
        "text": "One person’s message gives the answer for everyone."
      },
      {
        "id": "r2",
        "text": "“Still deciding” means the answer will be yes."
      },
      {
        "id": "r3",
        "text": "The club is still deciding. Jules’s answer is not known yet."
      }
    ],
    "explanation": "This is not a clear no or a clear yes. The club has more time to answer. Jules can keep the place on the list and check after Friday.",
    "skill": "uncertainty",
    "principle": "A choice still being made is not a finished answer."
  },
  {
    "id": "checking-complete",
    "family": "repeated-checking",
    "title": "The party note is checked",
    "scene": "Em checks a party note: the day, time and room match the plan. No new message has come. Em wants to read the same note again before drawing the decorations.",
    "facts": [
      "Em just checked the day, time and room. All match.",
      "No new message or change has arrived.",
      "Em has the details needed to draw the decorations."
    ],
    "claim": "Em must read this same note again before starting the decorations.",
    "options": [
      {
        "id": "a",
        "label": "Start drawing; check again if a party detail changes",
        "effect": "Em uses the finished check and knows what would call for another.",
        "valid": true,
        "reasonIds": [
          "r1"
        ]
      },
      {
        "id": "b",
        "label": "Keep reading until there is no doubt at all",
        "effect": "Em repeats the same check with no new question or clear finish.",
        "valid": false,
        "reasonIds": []
      },
      {
        "id": "c",
        "label": "Ignore every later party message because the note passed",
        "effect": "Em might miss a real change that matters to the plan.",
        "valid": false,
        "reasonIds": []
      },
      {
        "id": "d",
        "label": "Ask someone to repeat the same three details now",
        "effect": "Em hears the same facts again without filling any known gap.",
        "valid": false,
        "reasonIds": []
      }
    ],
    "reasons": [
      {
        "id": "r1",
        "text": "The needed check is done. A changed detail would call for another."
      },
      {
        "id": "r2",
        "text": "No planning can start while any doubt remains."
      },
      {
        "id": "r3",
        "text": "Once a note passes, later changes no longer matter."
      }
    ],
    "explanation": "The needed check is done even if a little doubt stays. Em can start. A new party detail would be a good reason to check again.",
    "skill": "stopping",
    "principle": "Finish the check. Know what would make you return."
  },
  {
    "id": "checking-new-information",
    "family": "repeated-checking",
    "title": "A new room note",
    "scene": "Em has checked the party room. A new message says, “Room change.” The plan still names the old room. No one has put up the decorations yet.",
    "facts": [
      "The new room message came after Em’s last check.",
      "The plan still shows the old room.",
      "There is time to change the plan before decorating."
    ],
    "claim": "Em does not need to look again because the room was checked.",
    "options": [
      {
        "id": "a",
        "label": "Keep the old room in the plan without reading",
        "effect": "Em may plan for a room that is no longer the party room.",
        "valid": false,
        "reasonIds": []
      },
      {
        "id": "b",
        "label": "Read the new note and change the details it affects",
        "effect": "Em checks the new room against the plan before decorating.",
        "valid": true,
        "reasonIds": [
          "r2"
        ]
      },
      {
        "id": "c",
        "label": "Start every part of the party plan all over again",
        "effect": "Em reopens choices that the new room note may not change.",
        "valid": false,
        "reasonIds": []
      },
      {
        "id": "d",
        "label": "Read the old note a few more times",
        "effect": "Em rereads old facts while leaving the new room note unopened.",
        "valid": false,
        "reasonIds": []
      }
    ],
    "reasons": [
      {
        "id": "r1",
        "text": "After one check, no later check can help."
      },
      {
        "id": "r2",
        "text": "A new room message gives a real reason to look again."
      },
      {
        "id": "r3",
        "text": "One changed detail means every part of the plan is wrong."
      }
    ],
    "explanation": "Something new has arrived. This is a good time to check again. Change the parts the new room affects; other parts can stay if they still fit.",
    "skill": "stopping",
    "principle": "Look again when a useful new fact arrives."
  },
  {
    "id": "plan-false-comfort",
    "family": "overconfident-plan",
    "title": "A game that is not ready",
    "scene": "Alex has ten minutes to set up a game. Two needed game pieces are missing. Alex has never timed the whole setup but says feeling sure means it will fit.",
    "facts": [
      "Alex has never timed the full setup.",
      "Two needed game pieces are missing.",
      "There are only ten minutes to set up."
    ],
    "claim": "The game will be ready on time because Alex feels sure.",
    "options": [
      {
        "id": "a",
        "label": "Feel even more sure but keep the same plan",
        "effect": "The missing pieces and unknown setup time stay the same.",
        "valid": false,
        "reasonIds": []
      },
      {
        "id": "b",
        "label": "Decide never to use this game again",
        "effect": "A problem with today’s plan becomes a ban on every later try.",
        "valid": false,
        "reasonIds": []
      },
      {
        "id": "c",
        "label": "Get the pieces, time the whole setup, then adjust",
        "effect": "Alex gets what is missing and uses a full try to plan the time.",
        "valid": true,
        "reasonIds": [
          "r3"
        ]
      },
      {
        "id": "d",
        "label": "Time opening the box and call the whole setup checked",
        "effect": "Alex counts one small part as a check of all the steps.",
        "valid": false,
        "reasonIds": []
      }
    ],
    "reasons": [
      {
        "id": "r1",
        "text": "Feeling sure supplies the missing pieces and tells us the time."
      },
      {
        "id": "r2",
        "text": "Timing the first part tells us how long every part takes."
      },
      {
        "id": "r3",
        "text": "The plan still needs the pieces and a full timed try."
      }
    ],
    "explanation": "Feeling sure does not find missing pieces or measure time. Try the whole setup with what it needs. Then make a time plan that fits what happened.",
    "skill": "prediction",
    "principle": "Check what a confident guess depends on."
  },
  {
    "id": "plan-supported-confidence",
    "family": "overconfident-plan",
    "title": "A game setup tried five times",
    "scene": "Alex has all the game pieces. Five full setups in this room each took eight minutes or less. There are twenty minutes now. A checked spare piece is ready. Nothing has changed.",
    "facts": [
      "Five full tries here each took eight minutes or less.",
      "Alex has twenty minutes this time.",
      "All needed pieces and a checked spare are ready."
    ],
    "claim": "The game will probably be ready on time, but it is not certain.",
    "options": [
      {
        "id": "a",
        "label": "Say there is no chance of anything going wrong",
        "effect": "Alex turns strong reasons to expect success into a promise of no problems.",
        "valid": false,
        "reasonIds": []
      },
      {
        "id": "b",
        "label": "Throw out the plan because feeling sure must be wrong",
        "effect": "Alex drops a tested plan without any new fact against it.",
        "valid": false,
        "reasonIds": []
      },
      {
        "id": "c",
        "label": "Keep practising without ever starting the game",
        "effect": "More tries replace using the plan despite its tests and extra time.",
        "valid": false,
        "reasonIds": []
      },
      {
        "id": "d",
        "label": "Use the tested plan and keep the spare nearby",
        "effect": "Alex uses the full practice tries and keeps help ready for a small problem.",
        "valid": true,
        "reasonIds": [
          "r1"
        ]
      }
    ],
    "reasons": [
      {
        "id": "r1",
        "text": "Full tries and extra time support starting, without promising success."
      },
      {
        "id": "r2",
        "text": "Every sure feeling must mean someone has made a mistake."
      },
      {
        "id": "r3",
        "text": "Repeated success means a later problem is impossible."
      }
    ],
    "explanation": "Alex has good reasons to expect this plan to work. It is okay to act on those reasons and keep the spare. A good plan does not need a perfect promise.",
    "skill": "prediction",
    "principle": "Let good checks support feeling more sure."
  },
  {
    "id": "setback-repairable",
    "family": "repairable-setback",
    "title": "Time to add the missing title",
    "scene": "Dara’s contest drawing comes back with its title missing. The helper says Dara can add it and send it again by six. It is four. The title is ready.",
    "facts": [
      "The drawing came back because its title was missing.",
      "The helper allows another try before six.",
      "The title is ready. Dara has two hours left."
    ],
    "claim": "The drawing came back, so nothing Dara does next can help.",
    "options": [
      {
        "id": "a",
        "label": "Add the title and send it back before six",
        "effect": "Dara fixes the missing part and returns the drawing to be judged.",
        "valid": true,
        "reasonIds": [
          "r2"
        ]
      },
      {
        "id": "b",
        "label": "Write down that a second try means Dara will win",
        "effect": "Dara turns a chance to fix the drawing into a promised prize.",
        "valid": false,
        "reasonIds": []
      },
      {
        "id": "c",
        "label": "Keep both facts: it came back, and a fix is allowed",
        "effect": "Dara keeps the setback in view and sees a useful step still open.",
        "valid": true,
        "reasonIds": [
          "r3"
        ]
      },
      {
        "id": "d",
        "label": "Wait until the time for another try is over",
        "effect": "The chance to add the ready title runs out without being used.",
        "valid": false,
        "reasonIds": []
      }
    ],
    "reasons": [
      {
        "id": "r1",
        "text": "Being allowed to fix a drawing means it will win."
      },
      {
        "id": "r2",
        "text": "The needed title is ready, and there is time to add it."
      },
      {
        "id": "r3",
        "text": "The drawing came back, but Dara can still do something useful."
      },
      {
        "id": "r4",
        "text": "Once a drawing comes back, every next step is closed."
      }
    ],
    "explanation": "The drawing really came back. Dara can still name the open next step or take it. Adding the title gives the drawing another chance; it does not promise a prize.",
    "skill": "action",
    "principle": "Keep what happened apart from what can happen next."
  },
  {
    "id": "setback-outside-control",
    "family": "repairable-setback",
    "title": "This contest has closed",
    "scene": "Dara finds the missing title after the contest closes. The rules and helper both say no late drawings. Another art show next week is still open and takes this kind of drawing.",
    "facts": [
      "This contest has closed.",
      "Both the rules and helper say no late drawings.",
      "Another open art show can take this kind of drawing."
    ],
    "claim": "A helpful next step can still get Dara into this closed contest.",
    "options": [
      {
        "id": "a",
        "label": "Keep sending the drawing until this contest takes it",
        "effect": "More copies do not change the clear rule against late drawings.",
        "valid": false,
        "reasonIds": []
      },
      {
        "id": "b",
        "label": "Accept this contest is closed; get the other show’s rules",
        "effect": "Dara keeps the missed contest clear and prepares for the art show still open.",
        "valid": true,
        "reasonIds": [
          "r1"
        ]
      },
      {
        "id": "c",
        "label": "Say missing this contest is only an imagined problem",
        "effect": "Dara denies a real missed chance instead of making a plan.",
        "valid": false,
        "reasonIds": []
      },
      {
        "id": "d",
        "label": "Decide this drawing cannot go into any art show",
        "effect": "One closed contest becomes a claim that ignores the other open show.",
        "valid": false,
        "reasonIds": []
      }
    ],
    "reasons": [
      {
        "id": "r1",
        "text": "This contest is closed, but the other show is still open."
      },
      {
        "id": "r2",
        "text": "Having a useful next step means the old loss can be undone."
      },
      {
        "id": "r3",
        "text": "One closed contest means every other show is closed too."
      }
    ],
    "explanation": "Dara cannot undo this missed contest with the choices here. That loss is real. A different art show is still possible. A useful next step does not have to undo the past.",
    "skill": "scope",
    "principle": "A next step can help without undoing the past."
  }
];
