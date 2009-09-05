;(function($) {
  
  var dbname = window.location.pathname.split('/')[1];
  var db     = $.couch.db(dbname); 
  
  Preso = function(doc) {
    var default_doc = {
      name: "",
      slides: [],
      type: "presentation" 
    };
    this.database   = db;
    this.attributes = $.extend(default_doc, doc);
  };
  
  Preso.default_callbacks = {
    success: function(resp) {
      Sammy.log('default success', resp);
    },
    error: function(resp) {
      Sammy.log('default error', resp);
    }
  };
    
  Preso.mergeCallbacks = function(callbacks) {
    return $.extend({}, Preso.default_callbacks, callbacks);
  };
  
  Preso.find = function(id, success) {
    db.openDoc(id, Preso.mergeCallbacks({
      success: function(resp) {
        var p = new Preso(resp);
        success.apply(p, [p]);
      }
    }));
  };
  
  $.extend(Preso.prototype, new Sammy.Object, {
    save: function(callback) {
      var self = this;
      this.database.saveDoc(this.attributes, Preso.mergeCallbacks({
        success: function(resp) {
          Sammy.log('preso.save', self, resp);
          $.extend(self.attributes, resp);
          if (callback) { callback.apply(self, [resp]); }
        }
      }));
    },
    slide: function(num, update) {
      var s;
      if (this.attributes.slides[num]) {
        s = this.attributes.slides[num];
      } else {
        s = {
          content_html: "",
          content: "",
          transition: "",
          position: num
        };
      }
      if (typeof update != 'undefined') {
        // do update
        $.extend(this.attributes.slides[num], s, update);
      } else {
        return s;
      }
    }
  });
  
  var app = $.sammy(function() {
    this.debug = true;
    this.element_selector = '#container';
    
    var current_preso = {};
    
    this.helpers({
      withCurrentPreso: function(callback) {
        var context = this;
        if (current_preso._id == this.params.id) {
          context.log('withCurrentPreso', 'using current', current_preso);
          callback.apply(context, [current_preso]);
        } else {
          Preso.find(this.params.id, function(p) {
            current_preso = p;
            context.log('withCurrentPreso', 'found', current_preso);
            callback.apply(context, [current_preso]);
          });
        }
      },
      markdown: function(text) {
        return new Showdown.converter().makeHtml(text);
      }
    });
    
    this.get('#/', function() {
      this.partial('templates/index.html.erb');
    });
    
    this.post('#/create', function(e) {
      // TODO: check for validity
      var preso = new Preso({name: this.params['name']});
      preso.save(function() {
        e.redirect('#/preso/' + this.attributes._id + "/edit/1");
      });
    });
    
    this.get('#/preso/:id/edit/:slide_id', function(e) {
      e.withCurrentPreso(function(preso) {
        e.preso = preso;
        e.partial('templates/edit.html.erb', {slide: e.preso.slide(e.params.slide_id)});
      });
    });
    
    this.post('#/preso/:id/edit/:slide_id', function(e) {
      e.withCurrentPreso(function(preso) {
        preso.slide(e.params.slide_id, {
          content: e.params['content'], 
          content_html: e.markdown(e.params['content'])
        });
        preso.save(function(p) {
          var next_id = parseInt(e.params.slide_id) + 1;
          e.redirect(e.join('/', '#', 'preso', this.attributes._id, 'edit', next_id));
        });
      });
    });
    
    
    this.bind('run', function() {
      // load time
      var context = this;
      $('.slide-form textarea')
        // live preview of slide editing
        .live('keyup', function() {
          $(this).parents('.slide-edit')
            .find('.slide-preview')
              .html(context.markdown($(this).val()));
        });
      
    });
  });
  
  $(function() {
    app.run('#/');
  });

})(jQuery);