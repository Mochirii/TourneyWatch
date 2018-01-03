
$(document).ready(function () {

  // Will function for when a tournament has not started, or
  // if a person drops out after a tournament has started
  function renderPlayerCount(playerRoster) {
    const playerNames = playerRoster.null;
    // if !playerNames, a person dropped out after
    // tournament has started
    if (!playerNames) {
      let count = 1;
      Object.keys(playerRoster).forEach((i) => {
        console.log(playerRoster[i])
        for (let p = 0; p < playerRoster[i].length; p++) {
          $(".player-table-stats").append(`
          <tr data-player-id="${playerRoster[i][p].battlenet_id}">
            <td scope="row">${count++}</td>
            <td><img src="${playerRoster[i][p].avatar}" class="img-fluid"> ${playerRoster[i][p].battlenet_id}</td>
            <td>${playerRoster[i][p].level}</td>
            <td>${playerRoster[i][p].games_won}</td>
          </tr>
        </tr>`)
        }
      })
    } else {
      Object.keys(playerNames).forEach((i) => {
        console.log(playerNames[i]);
          $(".player-table-stats").append(`
            <tr data-player-id="${playerNames[i].battlenet_id}">
              <td scope="row">${Number([i]) + 1}</td>
              <td><img src="${playerNames[i].avatar}" class="avatar"> ${playerNames[i].battlenet_id}</td>
              <td>${playerNames[i].level}</td>
              <td>${playerNames[i].games_won}</td>
            </tr>
          </tr>`)
      })
    }
  }
  
  function loadTable() {
    $.ajax({
      url: `/tournaments/cards.json`,
      data: {tournamentID: tournamentID},
      method: 'GET'
    }).done((playerRoster) => {
      renderPlayerCount(playerRoster);
    });
  }

  loadTable();


  $("[data-toggle='toggle']").click(function() {
    const selector = $(this).data("target");
    $(selector).toggleClass('in');
  });

  $(".fa-clipboard").click(function() {
    // const shareLink = $(this).data("link");
    // shareLink.select()
    // document.execCommand("Copy");
    // alert("copied!");
    
  })

});