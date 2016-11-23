function get_table(data, full_data, onclicks, onhovers, reorder, sortby, sortdir, filter_field, filter_text){
  console.log('get_table', onclicks, onhovers, reorder, sortby, sortdir);
  if (typeof(onclicks) === 'undefined'){
    onclicks = {};
  }
  if (typeof(onhovers) === 'undefined'){
    onhovers = {};
  }
  if (typeof(reorder) === 'undefined'){
    reorder = true;
  }
  
  if (typeof(sortdir) === 'undefined') sortdir = 'asc';

  // Loop once to get all cols
  var cols = Array();
  for (var i = 0, len = full_data.length; i < len; i++){
    for (var j in full_data[i]){
      if (_.indexOf(cols, j) < 0){
        if (j === 'timestamp' || j === 'meta_ts'){
          cols.unshift(j);
        }
        else {
          cols.push(j);
        }
      }
    }
  }
  console.log('cols', cols.join(','));

  console.log('reorder', reorder);
  if (reorder){
    console.log('reordering');
    var preferredCols = ['@timestamp', 'class', 'program', 'srcip', 'srcport', 'dstip', 'dstport', 'rawmsg'];

    var ret = [];
    var others = [];
    for (var i = 0, len = cols.length; i < len; i++){
      var preferredPosition = _.indexOf(preferredCols, cols[i]);
      if (preferredPosition > -1){
        ret[preferredPosition] = preferredCols[preferredPosition];
        console.log('spliced ' + preferredCols[preferredPosition] + ' to ' + preferredPosition);
      }
      else {
        others.push(cols[i]);
      }
    }
    ret.push.apply(ret, others.sort());
    ret = _.filter(ret, function(item){ return typeof(item) !== 'undefined'; });
    cols = ret;
  }

  console.log('reordered cols', cols);

  // Now lay out the table
  var table_el = document.createElement('table');
  $(table_el).addClass('pure-table');
  
  function sortTable(l_sortby){
    console.log('sorting by ' + l_sortby);
    var parent = table_el.parentNode;
    $(table_el).empty();
    
    if (l_sortby === sortby){
      if (sortdir === 'asc'){
        sortdir = 'desc';
      }
      else {
        sortdir = 'asc';
      }
    }
    if (sortdir === 'asc'){
      $(parent).append(get_table(_.sortBy(data, l_sortby), full_data, onclicks, onhovers, reorder, l_sortby, sortdir));
    }
    else {
      $(parent).append(get_table(_.sortBy(data, l_sortby).reverse(), full_data, onclicks, onhovers, reorder, l_sortby, sortdir));      
    }
    return;
  }

  function onkeyup(e){
    var l_filter_text = this.value;
    var l_filter_field = this.name;
    console.log('filter_text', filter_text);
    
    var l_data;
    // Avoid unnecessary and unhelpful early filtering
    if (l_filter_text.length > 0 && l_filter_text.length < 3) return;
    if (l_filter_text === ''){
      l_data = full_data;
    }
    else {
      l_data = _.filter(data.slice(), function(n){
        if (n[l_filter_field] && n[l_filter_field].match(l_filter_text)) return true;
        return false;
      });
    }

    $(table_el).empty();
    var parent = table_el.parentNode;
    $(parent).append(get_table(l_data, full_data, onclicks, onhovers, reorder, sortby, sortdir, l_filter_field, l_filter_text));
    var input_el = $('input[name="' + l_filter_field + '"]')[0];
    input_el.focus();
    var val = input_el.value; //store the value of the element
    input_el.value = ''; //clear the value of the element
    input_el.value = val; 
  }

  var thead_el = document.createElement('thead');
  //$(thead_el).addClass('etch-complex-table__thead');
  var tr_el = document.createElement('tr');
  //$(tr_el).addClass('etch-complex-table__thead__row');
  for (var i = 0, len = cols.length; i < len; i++){
    var field = cols[i];
    // Figure out if we are sorting by this col and if it is desc
    // var sortclass = 'etch-complex-table__cell--sortasc';
    // if (field === sortby && sortdir !== 'asc') 
    //   sortclass = 'etch-complex-table__cell--sortdesc';
    var th_el = document.createElement('th');
    // $(th_el).addClass('etch-complex-table__thead__th '
    //   + 'etch-complex-table__cell '
    //   + 'etch-complex-table__cell--sortable '
    //   + 'etch-complex_table__cell--alignright '
    //   + sortclass);
    var text_el = document.createTextNode(field);
    var span_el = document.createElement('span');
    // $(span_el).addClass('etch-column__title');
    $(span_el).append(text_el);
    span_el.data = field;
    $(span_el).on('click', function(e){
      console.log('click', this.data);
      sortTable(this.data);
    })
    $(th_el).append(span_el);
    var div_el = document.createElement('div');
    // $(div_el).addClass('etch-field');
    var input_el = document.createElement('input');
    input_el.type = 'text';
    input_el.name = field;
    input_el.size = 4;
    if (field === filter_field){
      input_el.value = filter_text;
    }
    $(div_el).append(input_el);
    $(input_el).on('keyup', function(e){
      if (e.keyCode !== 13) return;
      console.log('keypress');
      onkeyup.bind(this).call(e)
      // clearTimeout(EVENT_ON_KEYUP);
      // EVENT_ON_KEYUP = setTimeout(onkeyup.bind(this).call(e), 1500);
    });
    $(th_el).append(div_el);
    th_el.appendChild(text_el);
    tr_el.appendChild(th_el);
  }
  thead_el.appendChild(tr_el);
  table_el.appendChild(thead_el);

  var tbody_el = document.createElement('tbody');
  $(tbody_el).addClass('context-menu-one');

  var tag_values = {};
  for (var tag in TAGS){
    for (var tag_value in TAGS[tag]){
      tag_values[tag_value] = 1;
    }
  }

  for (var i = 0, len = data.length; i < len; i++){
    var tr_el = document.createElement('tr');
    //$(tr_el).addClass('etch-complex-table__tbody__row');
    if (i % 2 === 0){
      $(tr_el).addClass('pure-table-even');
    }
    else {
      $(tr_el).addClass('pure-table-odd');
    }
    var row = Array();
    for (var j in data[i]){
      if (_.indexOf(cols, j) > -1)
        row[_.indexOf(cols, j)] = data[i][j];
    }
    for (var j = 0; j < row.length; j++){
      var td_el = document.createElement('td');
      // $(td_el).addClass('etch-complex-table__cell '
      //   + 'etch-complex-table__cell--filtered '
      //   + 'etch-complex-table__cell--nowrap');
      var text = row[j];
      if (typeof(text) === 'undefined'){
        text = '';
      }
      $(td_el).attr('data_field', cols[j]);
      $(td_el).attr('data_value', encodeURIComponent(text));
      $(td_el).addClass('grid-cell');
      var text_el = document.createTextNode(text);
      if (typeof(onclicks[ cols[j] ]) !== 'undefined' 
        || typeof(onhovers[ cols[j] ]) !== 'undefined'){
        var a_el = document.createElement('a');
        // $(a_el).addClass('etch-anchor');
        a_el.href = 'javascript:void(0)';
        if (typeof(onclicks[ cols[j] ]) !== 'undefined'){
          $(a_el).on('click', onclicks[ cols[j] ]);  
        }
        if (typeof(onhovers[ cols[j] ]) !== 'undefined'){
          $(a_el).on('mouseenter', onhovers[ cols[j] ]);
        }
        a_el.appendChild(text_el);
        td_el.appendChild(a_el);
      }
      else {
        td_el.appendChild(text_el);
      }

      // Apply tags
      if (typeof(tag_values[text]) !== 'undefined'){
        tag_text = document.createElement('span');
        tag_text.innerText = '#' + tag + ' ';
        $(tag_text).addClass('tag');
        td_el.appendChild(tag_text);
      }
      
      // Apply favorites
      if (typeof(FAVORITES[text]) !== 'undefined'){
        var i = document.createElement('i');
        $(i).addClass('fa fa-heart fa-fw icon-tag');
        td_el.appendChild(i);
      }
    
      // Apply pivot as tag
      var pivot = TRANSCRIPT.latest('PIVOT');
      if (pivot && text === pivot.description){
        var i = document.createElement('i');
        $(i).addClass('fa fa-code-fork fa-fw icon-tag');
        td_el.appendChild(i);
      }
      
      tr_el.appendChild(td_el);
    }
    tbody_el.appendChild(tr_el);
  }

  table_el.appendChild(tbody_el);
  $(table_el).contextMenu({
    selector: 'td',
    callback: handle_context_menu_callback,
    /*items: {
      pivot: {name: 'Pivot', icon: function(){ return 'fa fa-level-down fa-fw'} },
      sep: '-----',
      scope: {name: 'Scope', icon: function(){ return 'fa fa-binoculars fa-fw'} },
      sep1: '-----',
      note: {name: 'Note', icon: function(){ return 'fa fa-comment fa-fw'} },
      sep2: '-----',
      tag: {name: 'Tag', icon: function(){ return 'fa fa-hashtag fa-fw'} },
      sep3: '-----',
      favorite: {name: 'Favorite', icon: function(){ return 'fa fa-star fa-fw'} },
    }*/
    items: CONTEXT_MENU_ITEMS
  });

  // $(table_el).on('click', function(e){
  //   console.log('clicked', this);
  // });
  return table_el;
}