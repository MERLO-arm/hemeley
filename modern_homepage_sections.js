      {/* Hero Section with Slider */}
      <section className="relative h-[85vh] min-h-[600px] overflow-hidden pt-16">
        {/* Background Slides */}
        {heroSlides.map((slide, index) => (
          <div
            key={index}
            className={`absolute inset-0 transition-opacity duration-1000 ${index === currentSlide ? 'opacity-100' : 'opacity-0'}`}
          >
            <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/40 to-black/70 z-10" />
            <img 
              src={slide.image} 
              alt={slide.title}
              className="w-full h-full object-cover"
            />
          </div>
        ))}

        {/* Hero Content */}
        <div className="relative z-20 h-full flex flex-col items-center justify-center text-center px-4">
          <div className="max-w-4xl mx-auto">
            <h1 className="font-heading text-5xl md:text-7xl text-white mb-4 tracking-wide animate-in fade-in slide-in-from-bottom-4 duration-700">
              {heroSlides[currentSlide].title}
            </h1>
            <p className="font-body text-xl md:text-2xl text-white/90 mb-8 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-150">
              {heroSlides[currentSlide].subtitle}
            </p>
            
            {/* Search Bar Mobile/Hero */}
            <div className="max-w-2xl mx-auto mb-8 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-300">
              <div className="relative">
                <Search size={22} className="absolute left-5 top-1/2 -translate-y-1/2 text-text-muted" />
                <input
                  type="text"
                  placeholder="Que voulez-vous manger aujourd'hui ?"
                  value={searchQuery}
                  onChange={(e) => { setSearchQuery(e.target.value); setShowSearchResults(true); }}
                  className="w-full bg-white rounded-full pl-14 pr-6 py-4 font-body text-lg shadow-2xl focus:ring-4 focus:ring-primary/30 focus:outline-none"
                />
              </div>
            </div>

            {/* Zone Selection Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center animate-in fade-in slide-in-from-bottom-4 duration-700 delay-500">
              {zones.map(z => (
                <button
                  key={z.id}
                  onClick={() => { setZone(z.id); document.getElementById('menus-section')?.scrollIntoView({ behavior: 'smooth' }); }}
                  className={`group flex items-center gap-3 px-8 py-4 rounded-full font-body font-medium transition-all ${zone === z.id ? 'bg-primary text-white shadow-lg scale-105' : 'bg-white/90 text-text hover:bg-white hover:scale-105'}`}
                  data-testid={`zone-btn-${z.id}`}
                >
                  <span className="text-2xl">{z.icon}</span>
                  <div className="text-left">
                    <p className="font-bold">{z.name}</p>
                    <p className="text-xs opacity-70">{z.description}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Slide Indicators */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-20 flex gap-2">
          {heroSlides.map((_, index) => (
            <button
              key={index}
              onClick={() => setCurrentSlide(index)}
              className={`w-3 h-3 rounded-full transition-all ${index === currentSlide ? 'bg-white w-8' : 'bg-white/50 hover:bg-white/70'}`}
            />
          ))}
        </div>
      </section>

      {/* Features Section */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="flex items-center gap-4 p-6 rounded-2xl hover:bg-stone-50 transition-colors">
              <div className="w-14 h-14 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0">
                <Clock size={28} className="text-primary" />
              </div>
              <div>
                <h3 className="font-heading text-xl text-text">Livraison Rapide</h3>
                <p className="font-body text-text-muted text-sm">En moins de 30 minutes</p>
              </div>
            </div>
            <div className="flex items-center gap-4 p-6 rounded-2xl hover:bg-stone-50 transition-colors">
              <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                <CheckCircle size={28} className="text-green-600" />
              </div>
              <div>
                <h3 className="font-heading text-xl text-text">Qualité Garantie</h3>
                <p className="font-body text-text-muted text-sm">Vendeurs vérifiés</p>
              </div>
            </div>
            <div className="flex items-center gap-4 p-6 rounded-2xl hover:bg-stone-50 transition-colors">
              <div className="w-14 h-14 bg-yellow-100 rounded-full flex items-center justify-center flex-shrink-0">
                <Crown size={28} className="text-yellow-600" />
              </div>
              <div>
                <h3 className="font-heading text-xl text-text">Programme VIP</h3>
                <p className="font-body text-text-muted text-sm">10% de réduction fidélité</p>
              </div>
            </div>
          </div>
        </div>
      </section>