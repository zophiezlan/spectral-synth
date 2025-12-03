# Contributing to Spectral Synthesizer

Thank you for your interest in contributing to the Spectral Synthesizer project! This document provides guidelines for contributing.

## Code of Conduct

- Be respectful and inclusive
- Focus on constructive feedback
- Help maintain a welcoming environment for all contributors

## Getting Started

1. Fork the repository
2. Clone your fork: `git clone https://github.com/YOUR_USERNAME/spectral-synth.git`
3. Create a feature branch: `git checkout -b feature/your-feature-name`
4. Make your changes
5. Test thoroughly
6. Commit with clear messages
7. Push to your fork
8. Open a Pull Request

## Development Guidelines

### Code Style

- Use **clear, descriptive variable and function names**
- Add **JSDoc comments** for all functions
- Keep functions **focused and single-purpose**
- Use **const** for constants, **let** for variables (avoid var)
- Follow existing code formatting conventions

### File Organization

- **app.js** - Main application coordinator
- **audio-engine.js** - Web Audio API synthesis
- **frequency-mapper.js** - IR to audio frequency conversion
- **visualizer.js** - Canvas-based visualization
- **build-library.js** - JCAMP-DX parser (Node.js)
- **index.html** - UI structure
- **style.css** - Styling and layout

### Adding New Features

1. **Discuss first** - Open an issue to discuss major changes
2. **Keep it minimal** - Make focused, incremental changes
3. **Document thoroughly** - Update README and add code comments
4. **Test extensively** - Verify in multiple browsers if possible
5. **Maintain compatibility** - Ensure backward compatibility

### Testing Checklist

Before submitting a PR, verify:

- [ ] Code runs without console errors
- [ ] All features work as expected
- [ ] No regressions in existing functionality
- [ ] Browser compatibility (Chrome, Firefox, Safari)
- [ ] Responsive design still works
- [ ] Keyboard shortcuts still function
- [ ] Performance is acceptable

### Commit Messages

Use clear, descriptive commit messages:

```
Good: "Add debouncing to search input for better performance"
Bad: "fix stuff"
```

Format:
```
Short summary (50 chars or less)

More detailed explanation if needed. Wrap at 72 characters.
Explain what changed and why.

- Bullet points are fine
- Reference issues: Fixes #123
```

## Areas Open for Contribution

### High Priority

- [ ] Additional substance FTIR spectra
- [ ] Improved sonification algorithms
- [ ] Better peak detection methods
- [ ] Performance optimizations
- [ ] Accessibility improvements
- [ ] Mobile optimization
- [ ] Unit tests

### Feature Ideas

- [ ] CSV/JCAMP-DX file import
- [ ] Audio file export (WAV/MP3)
- [ ] MIDI output support
- [ ] 3D visualization (spectrogram waterfall)
- [ ] Real-time spectrometer input
- [ ] Spectral blending/mixing
- [ ] Preset system for effects
- [ ] Tutorial/guided tour

### Documentation

- [ ] Video tutorials
- [ ] Scientific background articles
- [ ] Educational curriculum materials
- [ ] API documentation
- [ ] Usage examples

## Code Review Process

1. Submit PR with clear description
2. Maintainers review within 1-2 weeks
3. Address feedback and make changes
4. Once approved, PR will be merged

## Questions?

- Open an issue for bugs or feature requests
- Use discussions for questions and ideas
- Tag maintainers if you need attention

## License

By contributing, you agree that your contributions will be licensed under the MIT License.

## Thank You!

Every contribution, no matter how small, helps make this project better. We appreciate your time and effort!
