var viz_map = {
  aggregations: {
    sankey: build_sankey,
  },
  flat: {
    blocks: force_rectangles
  }
};

var TRANSCRIPT = [];
var RESULT_HISTORY = [];
var ANALYSIS_TREE = new AnalysisTree();
var TRANSCRIPT = new Transcript({
  error: function(s){ show_error('ERROR: ' + s) },
  notify: function(s){ notify(s); },
  finished: function(){
    // // Set latest scope
    // var latest_scope = this.latest('SCOPE');
    // if (latest_scope && latest_scope.visible) set_current_scope(latest_scope.description);

    // // Set latest pivot
    // var latest_pivot = this.latest('PIVOT');
    // if (latest_pivot && latest_pivot.visible) set_current_pivot(latest_pivot.description);
  }
});
var TAGS = {};
var FAVORITES = {};
var CONTEXT_MENU_ITEMS = {};
var POPOUT_WINDOW;
var TOGGLE = null;

$( document ).ajaxStart(function() {
  rotate_background();
  $('#modal').empty();
  var icon = document.createElement('span');
  $('#modal_outer').removeClass('background').addClass('foreground');
  //$(icon).addClass('fa fa-cloud fa-fw');
  var div = document.createElement('div');
  div.id = 'modal_background';
  $(div).addClass('foreground');
  var span = document.createElement('div');
  $(span).text('loading...');
  $(span).addClass('modal_text');
  $(div).append(span);
  $(document.body).append(div);
  $(icon).addClass('fa fa-cog fa-spin fa-fw');
  $('#modal').append(icon);
});

$( document ).ajaxComplete(function() {
  $('#modal').empty();
  $('#modal_background').remove();
  $('#modal_outer').removeClass('foreground').addClass('background');
});

$(document).ajaxSuccess(function(){ 
  // Clear error
  $('#error_container').empty();
});

function show_scope_nav(){
  $('#pulldown').empty();
  if (TOGGLE === 'scope'){
    TOGGLE = null;
    $('#scope_nav_button').removeClass('golden');
    return;
  }
  TOGGLE = 'scope';
  $('#scope_nav_button').addClass('golden');
  $.get('scopes', null, function(data, status, xhr){
    console.log('got scopes: ', data, typeof(data));
    // Lay out the categories in thirds
    var columns = [[], [], []];
    var keys = Object.keys(data);
    for (var i = 0, len = keys.length; i < len; i++){
      columns[i % columns.length].push(keys[i]);
    }
    console.log('columns', columns);
    for (var i = 0, len = columns.length; i < len; i++){
      var col = document.createElement('div');
      $(col).addClass('pure-u-1-3');
      for (var j = 0, jlen = columns[i].length; j < jlen; j++){
        var category_div = document.createElement('div');
        $(category_div).addClass('tags');
        var header_div = document.createElement('div');
        $(header_div).addClass('tag-label');
        header_div.innerText = columns[i][j];
        category_div.appendChild(header_div);
        col.appendChild(category_div);
        var content_div = document.createElement('div');
        for (var scope in data[ columns[i][j] ]){
          var scope_el = document.createElement('a');
          $(scope_el).addClass('tag');
          scope_el.innerText = scope;
          console.log('scope', scope, 'category', columns[i][j]);
          $(scope_el).click(function(e){
            e.preventDefault();
            TRANSCRIPT.update('SCOPE', {
              data: {value:this.scope},
              description: this.scope
            }, function(err, data){
              if (err) return;
              //set_current_scope(this.scope);
              $('#search_form input[name="query"]').val(this.search);
              submit_form();
              $('#pulldown').empty();
              $('#scope_nav_button').removeClass('golden');
              TOGGLE = null;
            }.bind(this));
          }.bind({search:data[ columns[i][j] ][scope], scope:scope}));
          category_div.appendChild(scope_el);
          category_div.appendChild(document.createElement('br'));
        }
      }
      $('#pulldown').hide();
      $('#pulldown').append(col);
      //$('#pulldown').show(300);
      $('#pulldown').slideDown();
    }
  }, 'json');
}

function rocketship(){
  var div = document.createElement('div');
  $(div).attr('style', 'position: absolute; top: 800px; left: 0; background-color: none;');
  var i = document.createElement('i');
  $(i).addClass('fa fa-rocket fw');
  $(i).attr('style', 'color: white; font-size: 10em; transform: rotate(45deg);');
  $(div).append(i);
  var textdiv = document.createElement('div');
  $(textdiv).text('LOADING...');
  $(textdiv).addClass('overwatch');
  $(textdiv).attr('style', 'font-size: 60px; color: white;');
  $(div).append(textdiv);
  $(document.body).append(div);

  var margin = 100;
  $(div).animate({left: window.innerWidth - (2 * margin) + 'px'}, 4000, function(){
    $(i).attr('style', 'color: white; font-size: 10em; transform: rotate(-45deg);');
  }); 
  $(div).animate({top: margin + 'px'}, 4000, function(){
    $(i).attr('style', 'color: white; font-size: 10em; transform: rotate(-135deg);');
  });
  $(div).animate({left: margin + 'px'}, 4000, function(){
    $(i).attr('style', 'color: white; font-size: 10em; transform: rotate(135deg);');
  });
  $(div).animate({top: '800px'}, 4000, function(){
    $(div).remove();
  });
}

function rocketships(){
  var div = document.createElement('div');
  $(div).attr('style', 'position: absolute; top: 400px; left: 0; background-color: none;');
  var baseline_size = 3;
  var baseline_shift = 50;
  var width = $(window).width();
  //for (var i = 1; i < 6; i++){
  for (var i = 6; i > 0; i--){
    var img = document.createElement('i');
    $(img).addClass('fa fa-rocket fw');
    $(img).attr('style', 'color: white; font-size: ' + (baseline_size * i) + 
      'em; transform: rotate(-45deg); position: absolute; left:' + ((width / 2) - ((baseline_shift * i) * Math.sqrt(i))) + 'px;');
      //' translate(' + (i * baseline_shift) + 'px, ' + (i * baseline_shift) + 'px);');
    $(div).append(img);
    $(img).animate({left: width - (width/2) - $(img).width() + ((baseline_shift * i) * Math.sqrt(i))}, 4000);
  }
  $(document.body).append(div);

  // var margin = 100;
  // $(div).animate({left: window.innerWidth - (2 * margin) + 'px'}, 4000, function(){
  //   $(i).attr('style', 'color: white; font-size: 10em; transform: rotate(-45deg);');
  // }); 
  // $(div).animate({top: margin + 'px'}, 4000, function(){
  //   $(i).attr('style', 'color: white; font-size: 10em; transform: rotate(-135deg);');
  // });
  // $(div).animate({left: margin + 'px'}, 4000, function(){
  //   $(i).attr('style', 'color: white; font-size: 10em; transform: rotate(135deg);');
  // });
  // $(div).animate({top: '800px'}, 4000, function(){
  //   $(div).remove();
  // });
}

function rocketships2(){
  var baseline_size = 3;
  var baseline_shift = 50;
  var width = $(window).width();
  //for (var i = 1; i < 6; i++){
  for (var i = 6; i > 0; i--){
    var div = document.createElement('div');
    $(div).attr('style', 'position: absolute; top: ' + $(window).height() + 'px; left:' + 
      ((width / 2) - ((baseline_shift * i) * Math.sqrt(i))) + 'px; background-color: none;');
    var p = document.createElement('p');
    $(div).append(p);
    var img = document.createElement('i');
    $(img).addClass('fa fa-rocket fw');
    $(img).attr('style', 'color: white; font-size: ' + (baseline_size * i) + 
      'em; transform: rotate(-45deg);');
      //' translate(' + (i * baseline_shift) + 'px, ' + (i * baseline_shift) + 'px);');
    $(p).append(img);
    p = document.createElement('p');
    $(div).append(p);
    $(p).attr('style', 'position: relative');
    var fire = document.createElement('div');
    $(fire).text('LOADING');
    $(fire).attr('style', 'font-family: Overwatch; transform: rotate(90deg); float:left; color: white; font-size: ' + (baseline_size * i) + 'em;')
    //$(fire).addClass('fa fa-fire fw');
    $(div).append(fire);
    //$(fire).attr('style', 'position:absolute; top: -' + (baseline_shift * i / 2) + 'px; color: white; transform: rotate(-180deg); font-size: ' + (baseline_size * i) + 'em;');
    
    $(document.body).append(div);
    // setTimeout(function(){
    //   $(this).animate({top: 0 - $(this).height() + 'px'}, 4000, function(){ console.log('done')});
    // }.bind(div), 1000 * i);
  }
}


function show_main_nav(){
  TOGGLE = null;
  ['pulldown', 'histogram_container', 'viz_container', 'grid_container'].forEach(function(x){
    $('#' + x).empty();
  });
  TRANSCRIPT.visualize();
  $('#pulldown').empty();
  $('#scope_nav_button').removeClass('golden');
}


function rotate_background(){
  var t = 0;
  var current = $('#galaxy_background').attr('src');
  if (current) t = parseInt(current.split('?t=')[1]);
  $('#galaxy_background').remove();
  var img = document.createElement('img');
  img.src = 'background?' + 't=' + parseInt(t + 1);
  img.id = 'galaxy_background';
  $(img).addClass('body-background-img');
  $(document.body).append(img);
}

function show_queue_nav(){
  $('#pulldown').empty();
  if (TOGGLE === 'queue'){
    TOGGLE = null;
    $('#queue_nav_button').removeClass('golden');
    return;
  }
  TOGGLE = 'queue';
  $('#queue_nav_button').addClass('golden');
  var keys = ['type', 'message', 'timestamp'];
  $.get('notifications', null, function(data, status, xhr){
    console.log('got notifications: ', data, typeof(data));
    var table = document.createElement('table');
    var thead = document.createElement('thead');
    var tr = document.createElement('tr');
    keys.forEach(function(k){
      var td = document.createElement('td');
      $(td).text(k);
      tr.appendChild(td);
    });
    thead.appendChild(tr);
    table.appendChild(thead);
    var tbody = document.createElement('tbody');
    for (var i = 0, len = data.length; i < len; i++){
      var tr = document.createElement('tr');
      keys.forEach(function(k){
        var td = document.createElement('td');
        if (k === 'timestamp'){
          $(td).text(new Date(data[i][k] * 1000).toISOString());  
        }
        else {
          $(td).text(data[i][k]);  
        }
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    }
    table.appendChild(tbody);
    $('#pulldown').append(table);
    //$('#pulldown').show(300);
    $('#pulldown').slideDown();
    
  }, 'json');
}

$(document).on('ready', function(){
  $('#logo').click(rocketship);
  rotate_background();
  //setInterval(rotate_background, 10000);

  $('#main_nav_button').click(function(e){
    e.preventDefault();
    show_main_nav();
  });
  $('#scope_nav_button').click(show_scope_nav);
  $('#queue_nav_button').click(show_queue_nav);
  $.get('notifications', null, function(data, status, xhr){
    console.log('notifications', data);
    $('#queue_nav_button').attr('data-count', data.length);
    for (var i = 0, len = data.length; i < len; i++){
    }
  })

  $.get('tags', null, function(data, status, xhr){
    console.log('tags', data);
    for (var i = 0, len = data.length; i < len; i++){
      if (typeof(TAGS[ data[i].tag ]) === 'undefined'){
        TAGS[ data[i].tag ] = {};
      }
      TAGS[ data[i].tag ][ data[i].value ] = 1;
    }
    update_tags();
    // Update context menu
    CONTEXT_MENU_ITEMS = {
      pivot: {name: 'Pivot', icon: function(){ return 'fa fa-level-down'} },
      sep: '-----',
      scope: {name: 'Scope', icon: function(){ return 'fa fa-binoculars'} },
      sep1: '-----',
      note: {name: 'Note', icon: function(){ return 'fa fa-comment'} },
      sep2: '-----',
      new_tag: {name: 'New Tag', icon: function(){ return 'fa fa-hashtag'} },
      existing_tags: { name: 'Tags:', items: {} },
      sep3: '-----',
      favorite: {name: 'Favorite', icon: function(){ return 'fa fa-star'} },
    };
    for (var tag in TAGS){
      CONTEXT_MENU_ITEMS.existing_tags.items[tag] = {
        name: tag,
        action: 'EXISTING_TAG',
        icon: function(){ return 'fa fa-hashtag fa-fw'}
      };
    }

  }, 'json');
  $.get('favorites', null, function(data, status, xhr){
    console.log('favorites', data);
    for (var i = 0, len = data.length; i < len; i++){
      FAVORITES[ data[i].value ] = 1;
    }
    update_favorites();
  }, 'json');
  TRANSCRIPT.render();
  
  //$('#sidebar').height($(window).height());
  //$('#transcript_container').height($(window).height());
  $('#start_date').val('2012-04-03T00:00:00');
  $('#end_date').val('2012-04-04T00:00:00');
  //$('#start_date').datepicker();
  //$('#end_date').datepicker();
  //$('#search_form input[name="query"]').val('_exists_:proto | groupby srcip,name,dstip | sankey');
  $('#search_form input[name="query"]').val('_exists_:proto | limit 100 | blocks');
  $('#query_submit').on('click', submit_form);
});

function new_search(str){
  // Split out the search from any transforms
  var current = $('#search_form input[name="query"]').val().split('|');
  console.log(current);
  $('#search_form input[name="query"]').val(str + ' |' + current.slice(1, current.length).join('|'));
  submit_form();
}
//192.168.2.10 |  groupby srcip,name,dstip  |  sankey
//_exists_:proto | groupby srcip,name,dstip | sankey

function clean_record(item){
  for (var k in item){
    if (typeof(item[k]) === 'object'){
      for (var j in item[k]){
        if (typeof(item[k][j]) === 'object'){
          var subrecord = clean_record(item[k][j]);
          for (var l in subrecord){
            item[k + '.' + j + '.' + l] = subrecord[l];
          }
        }
        else {
          item[k + '.' + j] = item[k][j];
        }
      }
      delete item[k];
    }
  }
  
  return item;
}

function render_search_result(data, status, xhr){
  console.log(data, xhr, status);
  $('#transcript_graph').remove();
  $('#histogram_container').empty();
  $('#viz_container').empty();
  if (typeof(data.results.error) !== 'undefined'){
    console.log(data.results.error.root_cause[0].reason);
    show_error(data.results.error.root_cause[0].reason);
    return;
  }
  if (typeof(xhr) !== 'undefined'){
    console.log('search came back with ref_id ', data);
    var action = TRANSCRIPT.update('SEARCH', data);
    ANALYSIS_TREE.propagate(action);
  }
  $('#search_form input[name="query"]').val(data.raw_query);
  //build_histogram(data);
  if (typeof(data.results.aggregations) !== 'undefined' &&
    typeof(data.results.aggregations.date_histogram) !== 'undefined')
    build_c3_multi_histogram(data);
    //build_c3_histogram(data);
  else if (typeof(data.results.aggregations) !== 'undefined') 
    build_c3_bar_chart(data);
  // Draw grid of results
  // var grid_el = document.createElement('div');
  // grid_el.id = 'grid';
  // $('body').append(grid_el);
  var raw_data = [];
  for (var i = 0, len = data.results.hits.hits.length; i < len; i++){
    raw_data.push(clean_record(data.results.hits.hits[i]._source));
  }
  
  if (typeof(POPOUT_WINDOW) !== 'undefined' && POPOUT_WINDOW.screen.height !== 0){
    var container = POPOUT_WINDOW.document.body.getElementById('grid_container');
    $(container).empty();
    $(container).append(get_table(raw_data, raw_data));
  }
  else {
    $('#grid_container').empty();
    var popout = document.createElement('i');
    $(popout).addClass('fa fa-window-restore fa-fw');
    $(popout).click(function(){
      var results = this;
      POPOUT_WINDOW = window.open('', null, 'menubar=no,status=no,height=' + window.screen.height
        + ',width=' + window.screen.width);
      POPOUT_WINDOW.document.write('<html><head><title>Results Grid</title>' +
        '<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/jquery-contextmenu/2.0.1/jquery.contextMenu.min.css">' +
        '<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/4.7.0/css/font-awesome.min.css">' +
        '<link rel="stylesheet" href="//code.jquery.com/ui/1.12.0/themes/base/jquery-ui.css">' +
        '<link rel="stylesheet" type="text/css" href="inc/demo.css">' +
        '</head><body>');
      // POPOUT_WINDOW.document.write($("#grid_container").html());
      POPOUT_WINDOW.document.write('</body></html>');
      $('#grid_container').empty();
      // $(POPOUT_WINDOW.document.body).addClass('body-background');
      // //var div = POPOUT_WINDOW.document.createElement('div');
      // //div.id = 'grid_container';
      POPOUT_WINDOW.document.on('ready', function(){
        this.$('body').append(get_table(results, results));
      });
      // //$(div).append(get_table(this, this));

      POPOUT_WINDOW.window.onbeforeunload = function(){
        $('#grid_container').append(popout);
        $('#grid_container').append(get_table(results, results));
      }.bind(this);
    }.bind(raw_data));
    $('#grid_container').append(popout);
    $('#grid_container').append(get_table(raw_data, raw_data));
  }
  
  if (typeof(data.query.viz) !== 'undefined'){
    $('#viz_container').height(500);
    console.log(data.query.viz);
    for (var i = 0, len = data.query.viz.length; i < len; i++){
      var viz = data.query.viz[i][0];
      if (typeof(viz_map.aggregations[viz]) !== 'undefined'){
        for (var k in data.results.aggregations){
          if (k === 'date_histogram') continue;
          var graph = build_graph_from_hits(data.results.aggregations[k].buckets);
          viz_map.aggregations[viz](graph);
        }
      }
      else {
        viz_map.flat[viz](data.results);
      }
    }
  }
  else {
    build_c3_bar_chart(data);
  }
}

function submit_form(e){
  if (e) e.preventDefault();

  //if (transcript.length) $('#transcript_container').style('height:500px;');

  var query = $('#search_form input[name="query"]').val();
  var start_date = moment($('#start_date').val()).unix();
  var end_date = moment($('#end_date').val()).unix();
  console.log('query: ' + query);
  
  var scope = TRANSCRIPT.latest("SCOPE");
  console.log('transcript at this point', JSON.stringify(TRANSCRIPT.transcript));
  console.log('latest scope', scope);
  var scope_id;
  if (scope) scope_id = scope.scope_id;
  var scope_clause = '';
  if (scope_id) scope_clause = 'scope_id=' + scope_id + '&';

  var pivot = TRANSCRIPT.latest('PIVOT');
  console.log('transcript', JSON.stringify(TRANSCRIPT.transcript));
  console.log('latest pivot', pivot);
  var pivot_id;
  if (pivot) pivot_id = pivot.id;
  var pivot_clause = '';
  if (pivot_id) pivot_clause = 'ref_id=' + pivot_id + '&';
  else if (scope) pivot_clause = 'ref_id=' + scope.id + '&';

  var query_string = 'search?' + pivot_clause + scope_clause + 'q=' + query;
  if (start_date) query_string += '&start=' + start_date;
  if (end_date) query_string += '&end=' + end_date;

  $.get(query_string, render_search_result);
}

// function set_current_scope(scope){
//   console.log('scope: ' + scope);
//   $('#scope_container').empty();
//   var i = document.createElement('i');
//   $(i).addClass('fa fa-close fw');
//   $(i).click(function(e){
//     e.preventDefault();
//     end_current_scope();
//   });
//   $('#scope_container').append(i);
//   var div = document.createElement('div');
//   $(div).text(scope);
//   $('#scope_container').append(div);
// }

// function end_current_scope(){
//   var scope = TRANSCRIPT.latest('SCOPE');
//   if (!scope) return;
//   var ref_id = scope.id;
//   var search = TRANSCRIPT.latest('SEARCH');
//   console.log('latest search', search);
//   if (search && search.scope_id === scope.scope_id)
//     ref_id = search.id;
//   TRANSCRIPT.update('END', {
//     description: scope.action + ' ' + scope.description,
//     scope_id: scope.scope_id,
//     ref_id: ref_id
//   }, function(err, data){
//     if (err) return;
//     TRANSCRIPT.update('SCOPE', { description: 'default', data: { value: 'default' }},
//       function(err, data){ $('#scope_container').empty(); });
//   });
// }

// function set_current_pivot(action){
//   console.log('action: ' + action);
//   $('#action_container').empty();
//   var i = document.createElement('i');
//   $(i).addClass('fa fa-close fw');
//   $(i).attr('style', 'float:left;');
//   $(i).click(function(e){
//     e.preventDefault();
//     end_current_pivot();
//   })
//   $('#action_container').append(i);
//   var div = document.createElement('div');
//   $(div).attr('style', 'float:left;');
//   $(div).text(action);
//   $('#action_container').append(div);
// }

// function end_current_pivot(){
//   var scope = TRANSCRIPT.latest('SCOPE');
//   var scope_id = scope ? scope.scope_id : 1;
//   var pivot = TRANSCRIPT.latest('PIVOT');
//   if (!pivot) return;
//   var ref_id = pivot.id;
//   var search = TRANSCRIPT.latest('SEARCH');
//   if (search && search.scope_id === scope_id)
//     ref_id = search.id;

//   // TRANSCRIPT.hide_item(pivot);
//   // $('#scope_container').empty();

//   // Set pivot to none
//   TRANSCRIPT.update('END', {
//       description: pivot.action + ' ' + pivot.description,
//       scope_id: scope_id,
//       ref_id: ref_id
//     }, function(err, data){
//       if (err) return;
//       $('#scope_container').empty();
//     });
// }

function notify(s){
  console.log('notify: ' + s);
  $('#notification_container').text(s);
}

function show_error(s){
  console.log('Error: ' + s);
  $('#error_container').text(s);
}

function find_menu_item(key, options){
  for (var k in options){
    if (k === key) return options[key];
    else if (typeof(options[k]) !== 'undefined' && options[k] && typeof(options[k].items) !== 'undefined'){
      var found = find_menu_item(key, options[k].items);
      if (found) return found;  
    }
  }
}

function handle_context_menu_callback(key, options) {
  var content = $(this).text();
  content = content.split('\n')[0];
  var scope = TRANSCRIPT.latest('SCOPE');
  var scope_id = scope ? scope.scope_id : 1;
  var item = TRANSCRIPT.latest('SEARCH');
  console.log(this, content, key, options);
  var menu_item = find_menu_item(key, options.items);
  console.log(key, menu_item);
  var key = key.toUpperCase();
  
  if (key === 'PIVOT'){
    var action = TRANSCRIPT.update(key, {
      description: content, 
      results_id: item.id, 
      scope_id: scope_id,
      //ref_id: scope ? scope.id : undefined
      ref_id: item.id
    }, function(err, data){
      if (err) return;
      console.log('action', action);
      ANALYSIS_TREE.propagate(content, 
        TRANSCRIPT.transcript[TRANSCRIPT.transcript.length - 1], true);
      //TRANSCRIPT.set_current_pivot(action);
      // TRANSCRIPT.load_item.bind([TRANSCRIPT, item]).call();
      $('#search_form input[name="query"]').val(content);
      submit_form();
    });
  }
  else if (key === 'NOTE'){
    create_note_dialog(content, scope_id);
  }
  else if (key === 'SCOPE'){
    var scope = TRANSCRIPT.update(key, {
      description: content, 
      data: { 
        value: content
      }
    }, function(err, data){
      if (err) return;
      //set_current_scope(scope);
      ANALYSIS_TREE.propagate(content, 
        TRANSCRIPT.transcript[TRANSCRIPT.transcript.length - 1]);
    });
  }
  else if (key === 'NEW_TAG'){
    create_tag_dialog(content, scope_id);
  }
  else if (menu_item && menu_item.action === 'EXISTING_TAG') add_tag(key, content, scope_id);
  else if (key === 'FAVORITE'){
    FAVORITES[content] = TRANSCRIPT.counter();
    update_favorites();
    var scope = TRANSCRIPT.update(key, {
      description: content,
      ref_id: TRANSCRIPT.latest('SEARCH').id,
      scope_id: scope_id,
      data: {
        value: content
      }
    });
  }
  else {
    throw Error('Unknown action ' + key);    

    // var scope = TRANSCRIPT.update(key, {scope:content});
    // ANALYSIS_TREE.propagate(content, 
    //   TRANSCRIPT.transcript[TRANSCRIPT.transcript.length - 1]);
  }
};

function create_note_dialog(content, scope_id){
  var div = document.createElement('div');
  div.id = 'write-note';
  div.title = 'Create Note';
  var span = document.createElement('h1');
  span.innerText = content;
  $(span).addClass('overwatch');
  div.appendChild(span);
  var form = document.createElement('form');
  div.appendChild(form);
  var fieldset = document.createElement('fieldset');
  form.appendChild(fieldset);
  var label = document.createElement('label');
  label.innerHTML = 'Note';
  fieldset.appendChild(label);
  var input = document.createElement('input');
  input.type = 'text';
  input.size = 80;
  input.name = 'note';
  input.id = 'note';
  $(input).attr('class', 'text ui-widget-content ui-corner-all');
  fieldset.appendChild(input);
  var submit = document.createElement('input');
  submit.type = 'submit';
  $(submit).attr('tabindex', -1);
  $(submit).attr('style', 'position:absolute; top:-1000px');
  fieldset.appendChild(submit);
  
  $('#transcript_container').append(div);

  function on_submit(event){
    event.preventDefault();
    console.log('SUBMIT', this);
    TRANSCRIPT.update('NOTE', {
      description: content + ' ' + $('#note').val(),
      ref_id: TRANSCRIPT.latest('SEARCH').id,
      scope_id: scope_id,
      data: {
        note: $('#note').val(),
        value: content
      }
    }, function(err, data){
      if (err) return;
      dialog.dialog('close');
      $('#write-note').remove();
    });
  }
  // modal
  var dialog; dialog = $( "#write-note" ).dialog({
    autoOpen: false,
    height: 400,
    width: 900,
    modal: true,
    buttons: {
      "Ok": on_submit,
      Cancel: function() {
        dialog.dialog( "close" );
      }
    },
    close: function() {
      form[ 0 ].reset();
    }
  });

  var form; form = dialog.find( "form" ).on( "submit", on_submit);

  //$( "#create-user" ).button().on( "click", function() {
    dialog.dialog( "open" );
  //});
}

function add_tag(tag, value, scope_id){
  tag = tag.toUpperCase();
  TRANSCRIPT.update('TAG', {
    description: tag + ' ' + value,
    ref_id: TRANSCRIPT.latest('SEARCH').id,
    scope_id: scope_id,
    data: {
      tag: tag,
      value: value
    }
  }, function(err, data){
    if (err) return;
    if (typeof(TAGS[tag]) === 'undefined') TAGS[tag] = {};
    TAGS[tag][value] = TRANSCRIPT.counter();
    update_tags();  
  });
}

function create_tag_dialog(content, scope_id){
  var div = document.createElement('div');
  div.id = 'create-tag';
  var form = document.createElement('form');
  div.appendChild(form);
  var fieldset = document.createElement('fieldset');
  form.appendChild(fieldset);
  var label = document.createElement('label');
  label.innerHTML = 'Tag';
  fieldset.appendChild(label);
  var input = document.createElement('input');
  input.type = 'text';
  input.size = 20;
  input.name = 'tag';
  input.id = 'tag';
  $(input).attr('class', 'text ui-widget-content ui-corner-all');
  fieldset.appendChild(input);
  var submit = document.createElement('input');
  submit.type = 'submit';
  $(submit).attr('tabindex', -1);
  $(submit).attr('style', 'position:absolute; top:-1000px');
  fieldset.appendChild(submit);
  
  document.body.appendChild(div);

  function on_submit(event){
    event.preventDefault();
    console.log('TAG', this);
    add_tag($('#tag').val(), content, scope_id);
    // var tagval = $('#tag').val();
    // TRANSCRIPT.update('TAG', {
    //   scope:tagval + ' ' + content,
    //   tag: tagval,
    //   value: content
    // });
    // if (typeof(TAGS[tagval]) === 'undefined') TAGS[tagval] = {};
    // TAGS[tagval][content] = TRANSCRIPT.counter();
    // update_tags();
    dialog.dialog('close');
    //document.body.removeChild(div);
  }
  // modal
  var dialog; dialog = $( "#create-tag" ).dialog({
    autoOpen: false,
    height: 200,
    width: 300,
    modal: true,
    buttons: {
      "Ok": on_submit,
      Cancel: function() {
        dialog.dialog( "close" );
      }
    },
    close: function() {
      form[ 0 ].reset();
    }
  });

  var form; form = dialog.find( "form" ).on( "submit", on_submit);
  dialog.dialog( "open" );
}

function update_tags(){
  $('#tags').empty();
  for (var tag in TAGS){
    var div = document.createElement('div');
    var span = document.createElement('span');
    span.innerText = '#' + tag;
    $(span).addClass('tag-label');
    $(span).click(function(){
      // collect all current values and search OR'ed
      var all = [];
      for (var item in TAGS[tag]){
        all.push(item); 
      }
      new_search(all.join(' OR '));
    });
    div.appendChild(span);
    var table = document.createElement('table');
    div.appendChild(table);
    var tbody = document.createElement('tbody');
    table.appendChild(tbody);
    for (var item in TAGS[tag]){
      var row = document.createElement('tr');
      tbody.appendChild(row);
      var cell = document.createElement('td');
      $(cell).addClass('tag');
      row.appendChild(cell);
      var span = document.createElement('i');
      $(span).addClass('fa fa-close fa-fw');
      $(span).click(function(e){
        var item = this; // use bound scope for item
        console.log(item);
        console.log('removing tag ' + tag + '=' + item);
        $.ajax('tags', {
          method: 'DELETE',
          data: {tag: tag, value: item},
          dataType: 'json',
          success: function(e){
            var item = this;
            delete TAGS[tag][item];
            update_tags();
            notify('Deleted ' + item + ' from tag ' + tag);
          }.bind(item)
        }).fail(function(e){
          console.error(e);
          var errstr = 'Unable to delete tag';
          console.error(errstr);
          show_error(errstr);
        });

      }.bind(item));
      cell.appendChild(span);
      var a = document.createElement('a');
      $(a).text(item);
      $(a).click(function(e){
        e.preventDefault();
        new_search(item);
      });
      //var text = document.createTextNode(item + ' ' + TAGS[tag][item]);
      cell.appendChild(a);
    }
    $('#tags').append(div);
  }
}

function update_favorites(){
  $('#favorites').empty();
  if (!Object.keys(FAVORITES).length) return;
  $('#favorites').addClass('respect-whitespace');
  var h1 = document.createElement('span');
  $(h1).addClass('sidebar_title');
  h1.innerText = 'Favorites';
  $('#favorites').append(h1);
  var hr = document.createElement('hr');
  $(hr).addClass('sidebar_title');
  $('#favorites').append(hr);
  var div = document.createElement('div');
  var table = document.createElement('table');
  div.appendChild(table);
  var tbody = document.createElement('tbody');
  table.appendChild(tbody);
  for (var favorite in FAVORITES){  
    var row = document.createElement('tr');
    tbody.appendChild(row);
    var cell = document.createElement('td');
    $(cell).addClass('tag');
    row.appendChild(cell);
    var img = document.createElement('i');
    $(img).addClass('fa fa-star golden');
    $(img).click(function(){ unfavorite(this) }.bind(favorite));
    cell.appendChild(img);
    //var text = document.createTextNode(favorite + ' ' + FAVORITES[favorite]);
    var a = document.createElement('a');
      $(a).text(favorite);
      $(a).click(function(e){
        e.preventDefault();
        new_search(favorite);
      });
    cell.appendChild(a);
  }
  $('#favorites').append(div);
}

function unfavorite(str){
  $.ajax('favorites', {
    method: 'DELETE',
    data: {
      value: str
    },
    dataType: 'json',
    success: function(){
      delete FAVORITES[str];
      console.log('FAVORITES IS NOW', FAVORITES);
      update_favorites();
    }
  }).fail(function(e){
    console.error(e);
    var errstr = 'Unable to unfavorite';
    console.error(errstr);
    show_error(errstr);
  })
}

function add_node(graph, name){
  // See if value already exists in nodes
  for (var i = 0, len = graph.nodes.length; i < len; i++){
    if (graph.nodes[i].label === name){
      return graph.nodes[i].name;
    }
  }
  
  graph.nodes.push({
    name: graph.nodes.length,
    label: name
  });
  console.log('added new node', graph.nodes[graph.nodes.length - 1]);

  return graph.nodes.length - 1;
}

function add_link(graph, src_id, dst_id, value){
  // See if this link already exists so we can add to the value
  for (var i = 0, len = graph.links.length; i < len; i++){
    if (graph.links[i].source === src_id && graph.links[i].target === dst_id){
      graph.links[i].value += value;
      return;
    }
  }
  // console.log('linking ' + src_id + ' to ' + dst_id + ' with values ' +
  //   graph.nodes[src_id] + ' and ' + graph.nodes[dst_id]);
  graph.links.push({
    source: src_id,
    target: dst_id,
    value: value
  });
}

