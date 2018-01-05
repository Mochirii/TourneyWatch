"use strict";

const express = require('express');
const router = express.Router();

module.exports = (knex, bcrypt, cookieSession, owjs) => {

  /**
   * Checks a string for special characters. Returns false if one is found
   * @param  {string} string string to be checked
   * @return {boolean}        returns false if invalid characters found
   */
  function checkInvalidCharacters(string) {
    return !(/^[a-zA-Z0-9-#]*$/.test(string));
  }

  function getUserIconAndbnetID(userID) {
    return knex
      .select("battlenet_id")
      .from("users")
      .where({ id: userID })
  }

  function checkInvalidbnetID(bnetID) {
    owjs.getAll('pc', 'us', bnetID)
      .then(() => {
        return false;
      })
      .catch((err) => {
        return true;
      })
  }

  /**
   * Converts a BNET ID into a string that Overwatch-js can handle
   * @param  {String} bnetID the BNET ID to convert
   * @return {String}        Bnet ID that Overwatch-js can handle
   */
  function convertBnetID(bnetID) {
    let name = bnetID.toLowerCase();
    name = name.charAt(0).toUpperCase() + name.slice(1);
    return name.replace('#', '-');
  }

  function playersEnrolled(tournamentID) {
    return knex
      .select("users.battlenet_id", "level", "games_won", "medal_gold", "medal_silver", "medal_bronze")
      .from("enrollments")
      .innerJoin("users", "users.id", "enrollments.user_id")
      .where({ tournament_id: tournamentID })
      .then((result) => {
        return result
      });
  }


  //Goes to registration page
  router.get('/new', (req, res) => {
    res.render('register', { email: req.session.email });
  });
  //Goes to login page
  router.get('/login', (req, res) => {
    res.render('login', { email: req.session.email });
  });

  //user registers
  router.post("/new", (req, res) => {
    console.log(req.body);
    const email = req.body.email.trim().toLowerCase();
    const password = req.body.password.trim();
    const battlenetID = req.body.battlenet.trim();

    //Converting bnet ID into a format that owjs can take


    if (checkInvalidCharacters(battlenetID)) {
      return res.sendStatus(400);
    }

    knex
      .select("email")
      .from("users")
      .where({ email: email })
      .then((results) => {
        console.log(results);
        if (results.length === 0) {
          owjs.getAll('pc', 'us', convertBnetID(battlenetID))
            .then(() => {
              knex
                .insert({ email: email, password: bcrypt.hashSync(password, 10), battlenet_id: battlenetID })
                .into('users')
                .returning('id')
                .then((results) => {
                  req.session.userID = results[0];
                  req.session.email = email;
                  req.session.battlenetID = battlenetID;
                  console.log('just registered, am results', results)
                  console.log('IN /NEW', req.session)
                  res.redirect("/");
                });
            })
            .catch((err) => {
              console.log('owjs is freaking out')
              res.sendStatus(400);
            })
          //stuff tha relies on it
        } else {
          res.sendStatus(400);
        }
      });
  });


  // logs a user in
  router.post("/login", (req, res) => {
    const email = req.body.email;
    const password = req.body.password;

    // error checking
    if (!email || !password) {
      res.sendStatus(400);
      return;
    }

    // Checking if user already exists, if user does not exist, throw back a 404
    knex
      .select("password", "id")
      .from("users")
      .where({ email: email })
      .then((results) => {
        if (results.length === 0) {
          res.sendStatus(404);
        } else if (bcrypt.compareSync(password, results[0].password)) {
          req.session.email = email;
          req.session.userID = results[0].id;
          console.log(results);
          console.log(req.session);
          res.redirect("/");
        } else {
          res.sendStatus(403);
        }
      });
  });

  // User logs out
  router.post("/logout", (req, res) => {
    req.session = null;
    res.send({ result: true });
  });


  router.get("/:id", (req, res) => {
    const email = req.session.email

    if (!email) {
      res.render('index', { email: email })
    } else {

      const asPlayerList = [];
      const asOwnerList = [];
      knex
        .select("tournament_id", "tournaments.name", "tournaments.is_started")
        .from("enrollments")
        .innerJoin("tournaments", "tournaments.id", "enrollments.tournament_id")
        .innerJoin("users", "users.id", "enrollments.user_id")
        .where({ 'users.id': req.params.id })
        .then(async (asPlayer) => {
          for (let t = 0; t < asPlayer.length; t++) {
            const playerRosterCount = await playersEnrolled(asPlayer[t].tournament_id);
            asPlayer[t].enrolledPlayers = playerRosterCount.length;
            asPlayerList.push(asPlayer[t]);
          }
          knex
            .select("tournaments.id", "name", "is_started", "no_of_teams")
            .from("tournaments")
            .innerJoin("users", "users.id", "tournaments.creator_user_id")
            .where({ 'users.id': req.params.id  })
            .then(async (asOwner) => {
              for (let t = 0; t < asOwner.length; t++) {
                const ownerRosterCount = await playersEnrolled(asOwner[t].id);
                asOwner[t].enrolledPlayers = ownerRosterCount.length;
                const isReady = (asOwner[t].enrolledPlayers === (asOwner[t].no_of_teams * 6));
                if (!isReady) {
                  asOwner[t].status = "Waiting";
                } else if (isReady && asOwner[t].is_started) {
                  asOwner[t].status = "In Progress";
                } else {
                  asOwner[t].status = "Ready";
                }
                asOwnerList.push(asOwner[t]);
              }
              //TO DO - REFACTOR SO NOT CALLBACK HELL

              getUserIconAndbnetID(req.params.id)
                .then((results) => {
                  //isUser is true if the user logged in is looking at their own profile
                  let isUser = false;
                  if(parseInt(req.session.userID) === parseInt(req.params.id)){
                    isUser = true;
                  }
                  res.render('profile', {
                    email: req.session.email,
                    asPlayerList: asPlayerList,
                    asOwnerList: asOwnerList,
                    battlenetID: results[0].battlenet_id,
                    userID: req.params.id,
                    isUser: isUser
                  });
                })
            });
        })
    }
  })

  router.post("/:id/edit", (req, res) => {
    console.log('param: ', req.params.id);
    console.log('session: ',req.session.userID);
 
    if (parseInt(req.params.id) !== parseInt(req.session.userID)) {
      console.log('invalid password');
      return res.sendStatus(400)
    }

      const password = req.body.password.trim();
      const battlenetID = req.body.battlenet.trim();
  
      //Converting bnet ID into a format that owjs can take
  
      if (checkInvalidCharacters(battlenetID)) {
        console.log('Invalid')
        return res.sendStatus(200);
      }

      owjs.getAll('pc', 'us', convertBnetID(battlenetID))
        .then(() => {
          knex("users")
          .where({id:req.session.userID})
          .update({battlenet_id:battlenetID, password: bcrypt.hashSync(password, 10) })
          .then(() => {
            console.log('this shouldve worked');
              req.session.battlenetID = battlenetID;
              res.sendStatus(200);
            });
        })
        .catch((err) => {
          console.log('OWJS fails')
          res.sendStatus(400);
        })
      
        
    });
 



  return router;
}
