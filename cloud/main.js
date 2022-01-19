Parse.Cloud.beforeSave("tags", (request) => {
    console.log(request.object.get("comming"));
    const code = request.object.get("code");
    const hours_before = 10;
  
  
    //Falls kein Zeitstempel - Zeitstempel setzen
    if(!request.object.get("time")){
      request.object.set("time", new Date());
    }
    //VISITOR ANHAND DES CODES SUCHEN
    var visitorQuery = new Parse.Query("visitors");
    visitorQuery.equalTo("code", code);
    return visitorQuery.find({useMasterKey: true}).then(result => {
        //FALLS VISITOR EXISTIERT
        if (result && result.length > 0) {
          request.object.set("visitor", result[0]);
  
          //FALLS BUCHUNGSOBJEKT AUS RFID (ohne gehen/kommen)
          if(request.object.get('comming') === undefined) {
              var query = new Parse.Query("tags");
              let now = new Date();
              let ago = now.getTime() - (hours_before * 3600 *1000);
              query.equalTo("code", code);
              //less than 10 hours
              query.greaterThan("time", new Date(ago));
              query.descending("createdAt");
              return query.find({useMasterKey:true}).then( tags => {
                  if (tags[0] && tags[0].get("comming")) {
                      //ES GIBT EINE BUCHUNG DIE NICHT MEHR ALS 10 STUNDEN ALT IST
                      let visitor = request.object.get("visitor");
                      visitor.set("present", false);
                          return visitor.save(null, { useMasterKey: true }).then(() => {
                              return request.object.set("comming", false);
                          });
  
                  } else {
                      //ES GIBT KEINE BUCHUNG IN DEN LETZTEN 10 STUNDEN
                      let visitor = request.object.get("visitor");
                      visitor.set("present", true);
                      return visitor.save(null, { useMasterKey: true }).then(() => {
                          return request.object.set("comming", true);
                      });
  
                  }
              });
          }
  
        } else {
          //FALLS VISITOR NOCH NICHT EXISTIERT HAT
          const User = Parse.Object.extend('visitors');
          let user = new User;
          user.set("code", code);
          user.set("first_name", "leer");
          user.set("last_name", "leer");
          user.set("street", "leer");
          user.set("number", "00");
          user.set("postcode", "00000");
          user.set("city", "Goslar");
          user.set("present", false);
          return user.save(null, { useMasterKey: true }).then( result => {
            request.object.set("visitor", result);
            request.object.set("initial", true);
            return request.object.set("comming", false);
          })
        }
  
      });
  })
  
  Parse.Cloud.job("resetOnline", async (request) => {
    //RESET PRESENT USERS
    var query_new = new Parse.Query("visitors");
    query_new.equalTo("present", true)
    var results_2 = await query_new.find({useMasterKey: true});
    for(var result of results_2) {
      const Log = Parse.Object.extend("tags")
      var log = new Log();
      var code = result.get("code")
      log.set("code", code)
      log.set("comming", false)
      await log.save(null, {useMasterKey: true})
      result.set("present", false)
      await result.save(null, {useMasterKey: true})
    }
    //CLEANUP OLD LOGS
    let query_2 = new Parse.Query("tags");
    let now = new Date();
    let ago = now.getTime() - (4 * 7 * 24 * 3600 * 1000)
    query_2.lessThan("time", new Date(ago))
    query_2.limit(5000)
    let results = await query_2.find({useMasterKey: true}).catch(error => {
      console.error(error)
    })
    results.forEach(result => {
      result.destroy({useMasterKey: true})
    })
  }) 